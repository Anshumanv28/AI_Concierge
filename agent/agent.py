"""
LiveKit voice agent for restaurant booking - LLM-driven version
"""
import os
import sys
from pathlib import Path

# Add agent directory to Python path for imports
agent_dir = Path(__file__).parent
if str(agent_dir) not in sys.path:
    sys.path.insert(0, str(agent_dir))

from dotenv import load_dotenv
from livekit.agents import JobContext, WorkerOptions, cli
from livekit.agents.voice import AgentSession
from livekit.plugins.openai import STT, TTS, LLM as OpenAILLM
from livekit.plugins.silero import VAD
from core.voice_agent import VoiceAgent
from prompts import BOOKING_AGENT_SYSTEM_PROMPT

# Load environment variables
load_dotenv()


class RestaurantBookingAgent(VoiceAgent):
    """Voice agent for restaurant bookings - LLM-driven"""
    
    def __init__(self):
        # Pass the comprehensive system prompt - LLM handles entire conversation flow
        super().__init__(
            instructions=BOOKING_AGENT_SYSTEM_PROMPT
        )
        self._session = None
    
    async def _on_start(self):
        """Called when agent starts - LLM will handle greeting via system prompt"""
        pass
    
    async def on_user_turn_completed(self, turn_ctx, new_message):
        """Handle user input - log and send transcript, let LLM handle the rest"""
        if not new_message or not new_message.content:
            return
        
        # Handle content as string or list
        if isinstance(new_message.content, list):
            user_text = " ".join([str(item) for item in new_message.content if item]).strip()
        else:
            user_text = str(new_message.content).strip()
        
        # Log user input
        print(f"💬 [USER] {user_text}")
        self._last_user_text = user_text

        # Send user transcript to frontend
        await self.send_transcript('user', user_text)
        
        # Let LLM handle the response based on the system prompt
        # The LLM will generate responses naturally through the AgentSession
    
    async def on_option_selected(self, option: str):
        """Handle option selection from frontend - treat as user input"""
        # Create a mock message object
        class MockMessage:
            def __init__(self, content):
                self.content = content
        
        # Process option selection as user input
        await self.on_user_turn_completed(None, MockMessage(option))


async def entrypoint(ctx: JobContext):
    """Entry point for the LiveKit agent"""
    try:
        # Check if OpenAI API key is available before connecting
        openai_key = os.getenv("OPENAI_API_KEY")
        if not openai_key or openai_key.strip() == "":
            print("ERROR: OPENAI_API_KEY not set. Cannot start agent.")
            return
        
        # Connect to the room (this accepts the job)
        await ctx.connect()
        
        # Create agent instance
        agent = RestaurantBookingAgent()
        
        # Create session with STT, LLM, TTS
        vad = VAD.load()
        stt = STT()
        session = AgentSession(
            vad=vad,
            stt=stt,
            llm=OpenAILLM(model="gpt-4o-mini"),
            tts=TTS(),
            user_away_timeout=None,
        )
        
        # Start session and agent
        await session.start(room=ctx.room, agent=agent)
        await agent.on_agent_start(session, room=ctx.room)
    except Exception as e:
        print(f"ERROR in entrypoint: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
