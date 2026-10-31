"""
Frontend communicator - handles communication with frontend via data channel
"""
from typing import Dict, Any, Optional
from livekit.agents.voice import AgentSession


class FrontendCommunicator:
    """Handles communication with frontend via LiveKit data channel"""
    
    def __init__(self, session: Optional[AgentSession] = None, room=None):
        self.session = session
        self.room = room
    
    def set_session(self, session: AgentSession, room=None):
        """Set the agent session and room for communication"""
        self.session = session
        self.room = room
    
    async def send_options(self, options: list, message: Optional[str] = None):
        """
        Send selectable options to frontend
        Args:
            options: List of option strings
            message: Optional message to display with options
        """
        if not self.session:
            return
        
        try:
            data = {
                'type': 'options',
                'options': options,
                'message': message,
            }
            await self._send_data(data)
        except Exception as e:
            print(f"Error sending options to frontend: {e}")
    
    async def send_current_speech(self, text: str):
        """
        Send current text being spoken (real-time)
        Args:
            text: Current speech text
        """
        if not self.session:
            return
        
        try:
            data = {
                'type': 'current_speech',
                'text': text,
            }
            await self._send_data(data)
        except Exception as e:
            print(f"Error sending current speech to frontend: {e}")
    
    async def send_state_update(self, state: str, message: Optional[str] = None):
        """
        Send agent state update to frontend
        Args:
            state: State name (e.g., 'thinking', 'processing', 'waiting_for_user')
            message: Optional state message
        """
        if not self.session:
            return
        
        try:
            data = {
                'type': 'state_update',
                'state': state,
                'message': message,
            }
            await self._send_data(data)
        except Exception as e:
            print(f"Error sending state update to frontend: {e}")
    
    async def send_transcript(self, speaker: str, text: str):
        """
        Send transcript entry to frontend
        Args:
            speaker: 'agent' or 'user'
            text: Transcript text
        """
        if not self.session:
            return
        
        try:
            data = {
                'type': 'transcript',
                'speaker': speaker,
                'text': text,
            }
            await self._send_data(data)
        except Exception as e:
            print(f"Error sending transcript to frontend: {e}")
    
    async def send_booking_confirmation(self, booking: Dict[str, Any]):
        """
        Send a confirmed booking's details to the frontend to render
        BookingConfirmation.
        Args:
            booking: Flat booking dict matching frontend/src/components/BookingConfirmation.js's
                expected fields (bookingId, numberOfGuests, bookingDate, bookingTime, status, ...)
        """
        if not self.session:
            return

        try:
            data = {
                'type': 'booking_confirmed',
                'booking': booking,
            }
            await self._send_data(data)
        except Exception as e:
            print(f"Error sending booking confirmation to frontend: {e}")

    async def _send_data(self, data: Dict[str, Any]):
        """Internal method to send data via data channel"""
        if not self.room:
            return
        
        try:
            import json
            
            data_str = json.dumps(data)
            data_bytes = data_str.encode('utf-8')
            
            # Get the agent's local participant (the agent itself)
            # In LiveKit agents, the agent is a participant in the room
            local_participant = self.room.local_participant
            if local_participant:
                await local_participant.publish_data(
                    data_bytes,
                    topic='agent-messages',
                    reliable=True
                )
        except Exception as e:
            # Silently fail - don't spam errors if room/participant not ready
            pass
