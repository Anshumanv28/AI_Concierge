"""
Core voice agent class - handles TTS/STT communication only
Delegates business logic to tool handlers
"""
import json
from livekit.agents import function_tool, RunContext
from livekit.agents.voice import Agent, AgentSession
from utils.tool_executor import ToolExecutor
from utils.frontend_communicator import FrontendCommunicator
from typing import Dict, Any, Optional


class VoiceAgent(Agent):
    """Core voice agent handling TTS/STT communication"""
    
    def __init__(self, instructions: str = ""):
        super().__init__(instructions=instructions)
        self.tool_executor = ToolExecutor()
        self.frontend_comm = FrontendCommunicator()
        self._session = None
        self._room = None
    
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
            date: Date in YYYY-MM-DD format (e.g., "2024-01-15")
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
            date: Date in YYYY-MM-DD format (e.g., "2024-01-15")
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
            HH:mm times - offer these instead of guessing.
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
        if customerEmail:
            params['customerEmail'] = customerEmail
        if customerContact:
            params['customerContact'] = customerContact
        
        result = await self.tool_executor.execute('create-booking', params)
        if result.get('success'):
            booking_data = result.get('data', {})
            booking_id = booking_data.get('booking', {}).get('_id') or booking_data.get('bookingId') or booking_data.get('_id')
            print(f"✅ [AGENT_TOOL] create_booking result: Booking created with ID {booking_id}")
            print(f"📋 [AGENT_TOOL] Booking details: {json.dumps(booking_data, default=str, indent=2)}")
            return booking_data
        else:
            error = result.get('error', 'Unknown error')
            error_data = result.get('data', {}) or {}
            print(f"❌ [AGENT_TOOL] create_booking failed: {error}")
            response = {'error': error}
            if error_data.get('alternatives'):
                response['alternatives'] = error_data['alternatives']
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
        bookingId: str
    ) -> Dict[str, Any]:
        """Send booking confirmation email.
        
        Args:
            bookingId: The booking ID to send confirmation for
        
        Returns:
            Email sending status
        """
        print(f"🔧 [AGENT_TOOL] send_email called with bookingId={bookingId}")
        params = {'bookingId': bookingId}
        result = await self.tool_executor.execute('send-email', params)
        if result.get('success'):
            email_data = result.get('data', {})
            print(f"✅ [AGENT_TOOL] send_email result: {email_data}")
            return email_data
        else:
            error = result.get('error', 'Unknown error')
            print(f"❌ [AGENT_TOOL] send_email failed: {error}")
            return {'error': error}
    
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
                
                # Call original callback if it exists
                if original_callback:
                    return original_callback(item)
            
            session._conversation_item_added = wrapped_callback
        
        # Set up data channel listener for option selections and other messages
        if room:
            import asyncio
            # Listen for data received events - use sync callback that creates async task
            # LiveKit's .on() requires a sync callback, so we wrap the async handler
            def on_data_received(data: bytes, participant, kind, topic):
                # Create async task from sync callback
                asyncio.create_task(self._on_data_received(data, participant, kind, topic))
            
            room.on("data_received", on_data_received)
        
        await self._on_start()
    
    async def _on_data_received(self, data: bytes, participant, kind, topic):
        """Handle data channel messages from frontend"""
        try:
            # Process messages from remote participants (users)
            # In LiveKit, the agent is the local participant, users are remote
            if participant and not participant.is_local:
                import json
                message = json.loads(data.decode('utf-8'))
                
                # Handle option selection
                if message.get('type') == 'option_selected':
                    await self.on_option_selected(message.get('option'))
                
                # Handle user message (typed input) - this is also handled by on_user_turn_completed
                elif message.get('type') == 'user_message':
                    # Log it but let on_user_turn_completed handle it
                    print(f"📨 [AGENT] Received user message via data channel: {message.get('text')}")
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
