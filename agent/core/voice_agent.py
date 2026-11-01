"""
Core voice agent class - handles TTS/STT communication only
Delegates business logic to tool handlers
"""
import asyncio
import json
from livekit.agents import function_tool, RunContext
from livekit.agents.voice import Agent, AgentSession
from openai import AsyncOpenAI
from utils.tool_executor import ToolExecutor
from utils.frontend_communicator import FrontendCommunicator
from utils.email_extractor import is_valid_email, extract_email
from typing import Dict, Any, Optional


# Reliable fallback for ending a call. In testing, the main conversational LLM
# (gpt-4o-mini, and even gpt-4o) reliably writes a goodbye message but almost
# never actually calls the end_conversation tool in the same turn - it seems
# to treat the words as the action. A regex-based text match was tried first
# and worked, but is brittle by nature (missed real phrasings like "that will
# be all" vs "that'll be all" until patched by hand - there will always be a
# next one). This instead makes a second, narrow LLM call whose only job is
# to decide whether to call end_call - no competing conversational text
# generation, no other tools to choose between, so the model reliably uses it
# when asked (same OpenAI function-calling mechanism as end_conversation
# itself, just isolated from the primary turn where it keeps getting skipped).
# Created lazily (not at import time): agent.py imports this module before
# calling load_dotenv(), so OPENAI_API_KEY isn't set yet when this module
# loads - AsyncOpenAI() raises immediately without it.
_end_call_client = None


def _get_end_call_client() -> AsyncOpenAI:
    global _end_call_client
    if _end_call_client is None:
        _end_call_client = AsyncOpenAI()
    return _end_call_client


_END_CALL_TOOL_SCHEMA = [{
    "type": "function",
    "function": {
        "name": "end_call",
        "description": "Call this if and only if the call should end right now.",
        "parameters": {"type": "object", "properties": {}},
    },
}]


async def _should_end_call(user_text: str, agent_text: str) -> bool:
    """Ask a dedicated LLM call whether the conversation just concluded."""
    if not user_text or not agent_text:
        return False
    try:
        response = await _get_end_call_client().chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You monitor a restaurant booking call and decide whether it just "
                        "ended. Call end_call only if the customer indicated they're done "
                        "(e.g. said that's all, no thanks, goodbye, asked to disconnect) AND "
                        "the assistant's reply is purely a closing/farewell message. If the "
                        "assistant's reply asks the customer anything at all - including a "
                        "trailing 'anything else?' or similar - the exchange is NOT over, even "
                        "if it also says goodbye-sounding words; don't call end_call in that "
                        "case. Otherwise, don't call anything."
                    ),
                },
                {
                    "role": "user",
                    "content": f"Customer: {user_text}\nAssistant: {agent_text}",
                },
            ],
            tools=_END_CALL_TOOL_SCHEMA,
            tool_choice="auto",
            max_tokens=20,
        )
        return bool(response.choices[0].message.tool_calls)
    except Exception as e:
        print(f"Error in _should_end_call: {e}")
        return False


class VoiceAgent(Agent):
    """Core voice agent handling TTS/STT communication"""

    def __init__(self, instructions: str = ""):
        super().__init__(instructions=instructions)
        self.tool_executor = ToolExecutor()
        self.frontend_comm = FrontendCommunicator()
        self._session = None
        self._room = None
        self._last_user_text = ""
        self._call_ending = False
    
    @function_tool()
    async def check_weather(
        self,
        ctx: RunContext,
        date: str,
        time: Optional[str] = None,
        location: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check weather forecast for a specific date and optionally time for more accurate predictions.

        Args:
            date: Date in YYYY-MM-DD format, computed from the live check_date result -
                  never a date you've seen as an example elsewhere
            time: Optional time in HH:mm format (24-hour, e.g., "19:00" for 7 PM). 
                  Providing time gives more accurate weather predictions for that specific time.
            location: Optional location (defaults to restaurant location)
        
        Returns:
            Weather data including condition, temperature, and description
        """
        print(f"🔧 [AGENT_TOOL] check_weather called with date={date}, time={time}, location={location}")
        params = {'date': date}
        if time:
            params['time'] = time
        if location:
            params['location'] = location
        result = await self.tool_executor.execute('weather', params)
        if result.get('success'):
            weather_data = result.get('data', {})
            print(f"✅ [AGENT_TOOL] check_weather result: {weather_data}")
            return weather_data
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ [AGENT_TOOL] check_weather failed: {error}")
            return {'error': error}
    
    @function_tool()
    async def check_availability(
        self,
        ctx: RunContext,
        date: str,
        time: Optional[str] = None
    ) -> Dict[str, Any]:
        """Check if a date/time slot is available for booking.

        Args:
            date: Date in YYYY-MM-DD format, computed from the live check_date result -
                  never a date you've seen as an example elsewhere
            time: Optional time in HH:mm format (24-hour, e.g., "19:00" for 7 PM)

        Returns:
            Availability status with `available` boolean and existing bookings count.
            When the slot is taken, includes an `alternatives` array of up to 3 real
            nearby available HH:mm times - offer these instead of guessing.
        """
        print(f"🔧 [AGENT_TOOL] check_availability called with date={date}, time={time}")
        params = {'date': date}
        if time:
            params['time'] = time
        result = await self.tool_executor.execute('check-availability', params)
        if result.get('success'):
            availability_data = result.get('data', {})
            print(f"✅ [AGENT_TOOL] check_availability result: {availability_data}")
            return availability_data
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ [AGENT_TOOL] check_availability failed: {error}")
            return {'error': error}
    
    @function_tool()
    async def create_booking(
        self,
        ctx: RunContext,
        numberOfGuests: int,
        bookingDate: str,
        bookingTime: str,
        cuisinePreference: Optional[str] = None,
        specialRequests: Optional[str] = None,
        seatingPreference: Optional[str] = None,
        customerName: Optional[str] = None,
        customerEmail: Optional[str] = None,
        customerContact: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new restaurant booking.
        
        Args:
            numberOfGuests: Number of guests (required)
            bookingDate: Date in YYYY-MM-DD format (required)
            bookingTime: Time in HH:mm format, 24-hour (required, e.g., "19:00" for 7 PM)
            cuisinePreference: Optional cuisine preference
            specialRequests: Optional special requests or dietary restrictions
            seatingPreference: Optional seating preference ("indoor" or "outdoor")
            customerName: Optional customer name
            customerEmail: Optional customer email for confirmation
            customerContact: Optional customer contact number
        
        Returns:
            Created booking data including booking ID. On failure due to a conflicting
            slot, includes an `alternatives` array of up to 3 real nearby available
            HH:mm times - offer these instead of guessing. If the provided email looked
            invalid, includes an `emailWarning` - ask the customer to repeat their email.
        """
        print(f"🔧 [AGENT_TOOL] create_booking called with guests={numberOfGuests}, date={bookingDate}, time={bookingTime}")
        params = {
            'numberOfGuests': numberOfGuests,
            'bookingDate': bookingDate,
            'bookingTime': bookingTime
        }
        if cuisinePreference:
            params['cuisinePreference'] = cuisinePreference
        if specialRequests:
            params['specialRequests'] = specialRequests
        if seatingPreference:
            params['seatingPreference'] = seatingPreference
        if customerName:
            params['customerName'] = customerName
        if customerContact:
            params['customerContact'] = customerContact

        # Normalize the spoken email before forwarding it - STT often mangles
        # addresses (e.g. "john at gmail dot com"), and a malformed address
        # would otherwise be silently saved and fail to deliver.
        email_warning = None
        if customerEmail:
            normalized_email = customerEmail if is_valid_email(customerEmail) else extract_email(customerEmail)
            if normalized_email:
                params['customerEmail'] = normalized_email
            else:
                email_warning = (
                    "The email address didn't look valid, so it wasn't saved. "
                    "Ask the customer to repeat their email clearly if they still want a confirmation."
                )

        result = await self.tool_executor.execute('create-booking', params)
        if result.get('success'):
            booking_data = result.get('data', {})
            booking_id = booking_data.get('booking', {}).get('_id') or booking_data.get('bookingId') or booking_data.get('_id')
            print(f"✅ [AGENT_TOOL] create_booking result: Booking created with ID {booking_id}")
            print(f"📋 [AGENT_TOOL] Booking details: {json.dumps(booking_data, default=str, indent=2)}")
            if email_warning:
                booking_data['emailWarning'] = email_warning

            # Notify the frontend so BookingConfirmation can render. The backend
            # nests the Mongoose doc under `booking` and calls the id field `_id`;
            # flatten it to the shape BookingConfirmation.js expects.
            booking_doc = booking_data.get('booking')
            if booking_doc:
                await self.frontend_comm.send_booking_confirmation({
                    **booking_doc,
                    'bookingId': booking_doc.get('bookingId') or booking_doc.get('_id'),
                })

            return booking_data
        else:
            error = result.get('error', 'Unknown error')
            error_data = result.get('data', {}) or {}
            print(f"❌ [AGENT_TOOL] create_booking failed: {error}")
            response = {'error': error}
            if error_data.get('alternatives'):
                response['alternatives'] = error_data['alternatives']
            if email_warning:
                response['emailWarning'] = email_warning
            return response
    
    @function_tool()
    async def check_date(
        self,
        ctx: RunContext
    ) -> Dict[str, Any]:
        """Get current date and time for context awareness when users say 'today', 'tomorrow', 'day after tomorrow', etc.
        Also helps detect if users are trying to book in the past.
        
        Returns:
            Current date (YYYY-MM-DD) and time (HH:mm in 24-hour format), along with formatted date and day of week
        """
        print(f"🔧 [AGENT_TOOL] check_date called")
        result = await self.tool_executor.execute('check-date', {})
        if result.get('success'):
            date_data = result.get('data', {})
            print(f"✅ [AGENT_TOOL] check_date result: Today is {date_data.get('today')} at {date_data.get('currentTime')}")
            return date_data
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ [AGENT_TOOL] check_date failed: {error}")
            return {'error': error}
    
    @function_tool()
    async def send_email(
        self,
        ctx: RunContext,
        bookingId: str,
        customerEmail: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send booking confirmation email.

        Args:
            bookingId: The booking ID to send confirmation for
            customerEmail: Only pass this if the customer is correcting the email
                address on file (e.g. "that's wrong, it's actually ..."). Omit it
                for a plain resend to the address already on the booking.

        Returns:
            Email sending status
        """
        print(f"🔧 [AGENT_TOOL] send_email called with bookingId={bookingId}, customerEmail={customerEmail}")
        params = {'bookingId': bookingId}

        email_warning = None
        if customerEmail:
            normalized_email = customerEmail if is_valid_email(customerEmail) else extract_email(customerEmail)
            if normalized_email:
                params['customerEmail'] = normalized_email
            else:
                email_warning = (
                    "The corrected email address didn't look valid, so it wasn't used. "
                    "Ask the customer to repeat their email clearly."
                )

        result = await self.tool_executor.execute('send-email', params)
        if result.get('success'):
            email_data = result.get('data', {})
            print(f"✅ [AGENT_TOOL] send_email result: {email_data}")
            if email_warning:
                email_data['emailWarning'] = email_warning
            return email_data
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ [AGENT_TOOL] send_email failed: {error}")
            response = {'error': error}
            if email_warning:
                response['emailWarning'] = email_warning
            return response

    @function_tool()
    async def set_microphone(
        self,
        ctx: RunContext,
        enabled: bool
    ) -> Dict[str, Any]:
        """Turn the customer's microphone on or off.

        This is a real action - it must actually be called. Writing a
        sentence like "go ahead and speak" does nothing to the mic by
        itself; only calling this tool changes it.

        Call this with enabled=True right when you want the customer to speak
        (e.g. right after you ask them a question), and enabled=False while
        you are speaking or thinking, or once you have everything you need
        and are wrapping up. The customer can still override this manually
        from their side, so don't rely on it as the only way turns happen -
        it's a convenience cue, not a hard lock.

        Args:
            enabled: True to turn the mic on, False to turn it off

        Returns:
            Confirmation that the request was sent
        """
        print(f"🔧 [AGENT_TOOL] set_microphone called with enabled={enabled}")
        await self.frontend_comm.send_mic_control(enabled)
        return {'micEnabled': enabled}

    @function_tool()
    async def end_conversation(
        self,
        ctx: RunContext
    ) -> Dict[str, Any]:
        """End the call with the customer.

        This actually disconnects the customer the moment it runs. Writing
        "goodbye" or "*ending the call*" in your text reply does NOT end
        anything by itself - you must call this tool in the same turn as
        your goodbye message, every single time, with no exceptions.

        Only call this after the customer has explicitly confirmed there is
        nothing else they need (e.g. they said "that's all", "no thanks",
        "goodbye"). Say your goodbye message first, THEN call this tool -
        calling it ends the session, so nothing you say after it will reach
        the customer. The transcript stays visible to the customer after
        the call ends.

        Returns:
            Confirmation that the session is ending
        """
        print("🔧 [AGENT_TOOL] end_conversation called")
        await self._end_conversation_now()
        return {'ending': True}

    async def _end_conversation_now(self):
        """Actually end the call: signal the frontend, then disconnect this
        participant. Called either by the end_conversation tool (when the LLM
        does call it, which is rare in practice) or by _check_and_end_call's
        dedicated inference call (the reliable path - see _should_end_call's
        docstring)."""
        if self._call_ending:
            return
        self._call_ending = True
        await self.frontend_comm.send_end_session()
        # Give the data message a moment to flush over the wire before this
        # participant (the agent) leaves the room.
        asyncio.create_task(self._disconnect_after_delay())

    async def _check_and_end_call(self, user_text: str, agent_text: str):
        """Ask the dedicated end-call classifier and act on it. Scheduled as
        a background task from the transcript callback so it never blocks
        the agent's own turn."""
        if self._call_ending:
            return
        if await _should_end_call(user_text, agent_text):
            print("🔧 [AGENT] end-call classifier says yes, ending call")
            await self._end_conversation_now()

    async def _disconnect_after_delay(self, delay_seconds: float = 2.0):
        await asyncio.sleep(delay_seconds)
        if self._room:
            try:
                await self._room.disconnect()
            except Exception as e:
                print(f"Error disconnecting agent from room: {e}")

    async def on_agent_turn(self, turn_ctx):
        """
        Allow LLM to generate responses naturally.
        Transcripts are captured via _conversation_item_added callback.
        """
        # Call super() to allow LLM to generate responses
        await super().on_agent_turn(turn_ctx)
    
    async def on_message(self, message):
        """
        Allow LLM to process messages naturally.
        The base Agent class will handle message processing and LLM response generation.
        """
        # Call super() to allow LLM to process messages and generate responses
        await super().on_message(message)
    
    async def on_agent_start(self, session: AgentSession, room=None):
        """Called when agent starts"""
        self._session = session
        self._room = room
        self.frontend_comm.set_session(session, room)
        
        # Intercept agent speech via conversation_item_added callback
        # This is called when the LLM adds messages to the conversation history
        if session and hasattr(session, '_conversation_item_added'):
            original_callback = session._conversation_item_added
            
            def wrapped_callback(item):
                """Intercept conversation items to capture agent responses"""
                # Check if this is an agent/assistant message
                if hasattr(item, 'role') and hasattr(item, 'content'):
                    if item.role == 'assistant' or item.role == 'agent':
                        # Extract text from content (may be string or list)
                        text = None
                        if isinstance(item.content, list):
                            # Join list items into a single string
                            text = ' '.join([str(part) for part in item.content if part]).strip()
                        elif isinstance(item.content, str):
                            text = item.content.strip()
                        else:
                            text = str(item.content).strip()
                        
                        # Log and send transcript to frontend
                        if text:
                            print(f"🔊 [AGENT] {text}")
                            import asyncio
                            asyncio.create_task(self.send_transcript('agent', text))

                            # Reliable end-of-call fallback - see
                            # _should_end_call's docstring for why this exists
                            # instead of just relying on the end_conversation
                            # tool call during the main turn.
                            if not self._call_ending:
                                asyncio.create_task(
                                    self._check_and_end_call(self._last_user_text, text)
                                )
                
                # Call original callback if it exists
                if original_callback:
                    return original_callback(item)
            
            session._conversation_item_added = wrapped_callback
        
        # Set up data channel listener for option selections and other messages
        if room:
            import asyncio
            # Listen for data received events - use sync callback that creates async task
            # LiveKit's .on() requires a sync callback, so we wrap the async handler.
            # The SDK emits a single DataPacket(data, kind, participant, topic) object,
            # not separate positional args.
            def on_data_received(data_packet):
                asyncio.create_task(
                    self._on_data_received(
                        data_packet.data,
                        data_packet.participant,
                        data_packet.kind,
                        data_packet.topic,
                    )
                )
            
            room.on("data_received", on_data_received)
        
        await self._on_start()
    
    async def _on_data_received(self, data: bytes, participant, kind, topic):
        """Handle data channel messages from frontend"""
        try:
            # DataPacket.participant is RemoteParticipant | None (None only for
            # data sent by a server SDK), so a truthy participant is always remote.
            if participant:
                import json
                message = json.loads(data.decode('utf-8'))
                
                # Handle option selection
                if message.get('type') == 'option_selected':
                    await self.on_option_selected(message.get('option'))
                
                # Handle user message (typed input). Unlike voice, text input never goes
                # through STT/AgentSession's automatic turn pipeline, so we have to both
                # report the turn (for transcript/logging, same as on_option_selected) and
                # explicitly ask the session to generate a reply for it.
                elif message.get('type') == 'user_message':
                    text = message.get('text')
                    print(f"📨 [AGENT] Received user message via data channel: {text}")
                    if text and self._session:
                        import types
                        await self.on_user_turn_completed(
                            None, types.SimpleNamespace(content=text)
                        )
                        self._session.generate_reply(user_input=text)
        except Exception as e:
            print(f"Error handling data channel message: {e}")
    
    async def on_option_selected(self, option: str):
        """Override this method in subclasses to handle option selections"""
        pass
    
    async def _on_start(self):
        """Override this method in subclasses for custom startup logic"""
        pass
    
    async def on_user_turn_completed(self, turn_ctx, new_message):
        """Override this method in subclasses to handle user input"""
        pass
    
    async def execute_tool(self, tool_name: str, params: dict) -> dict:
        """
        Execute a tool
        Args:
            tool_name: Name of the tool
            params: Tool parameters
        Returns:
            Tool execution result
        """
        # Send state update
        await self.frontend_comm.send_state_update('processing', f'Executing {tool_name}...')
        
        result = await self.tool_executor.execute(tool_name, params)
        
        # Clear processing state
        await self.frontend_comm.send_state_update(None)
        
        return result
    
    async def send_options(self, options: list, message: str = None):
        """Send selectable options to frontend"""
        await self.frontend_comm.send_options(options, message)
    
    async def send_current_speech(self, text: str):
        """Send current speech text to frontend"""
        await self.frontend_comm.send_current_speech(text)
    
    async def send_state_update(self, state: str, message: str = None):
        """Send state update to frontend"""
        await self.frontend_comm.send_state_update(state, message)
    
    async def send_transcript(self, speaker: str, text: str):
        """Send transcript entry to frontend"""
        await self.frontend_comm.send_transcript(speaker, text)
