"""
HTTP client for making requests to the backend API
"""
import aiohttp
import os
from typing import Dict, Optional, Any


class BackendAPIClient:
    """Client for communicating with the backend REST API"""
    
    def __init__(self):
        self.base_url = os.getenv('BACKEND_URL', 'http://localhost:5000')
    
    async def get_weather(self, date: str, time: Optional[str] = None) -> Dict[str, Any]:
        """
        Fetch weather data for a specific date and optionally time
        Args:
            date: Date in YYYY-MM-DD format
            time: Optional time in HH:mm format (24-hour, e.g., "19:00" for 7 PM)
        Returns:
            Weather data dict with condition, temperature, description
        """
        time_str = f" at {time}" if time else ""
        print(f"🌐 [API_CLIENT] Fetching weather for date: {date}{time_str}")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/weather/{date}"
            params = {}
            if time:
                params['time'] = time
            print(f"🌐 [API_CLIENT] GET {url} with params: {params}")
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    print(f"✅ [API_CLIENT] Weather fetched successfully")
                    return data.get('data', {})
                else:
                    error_data = await response.json()
                    error_msg = f"Weather API error: {error_data.get('error', 'Unknown error')}"
                    print(f"❌ [API_CLIENT] {error_msg}")
                    raise Exception(error_msg)
    
    async def create_booking(self, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new booking
        Args:
            booking_data: Dictionary with booking details
        Returns:
            Created booking data
        """
        print(f"🌐 [API_CLIENT] Creating booking with data: {booking_data}")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/bookings"
            print(f"🌐 [API_CLIENT] POST {url}")
            async with session.post(url, json=booking_data) as response:
                if response.status == 201:
                    data = await response.json()
                    print(f"✅ [API_CLIENT] Booking created successfully")
                    return data.get('data', {})
                else:
                    error_data = await response.json()
                    error_msg = f"Booking API error: {error_data.get('error', 'Unknown error')}"
                    print(f"❌ [API_CLIENT] {error_msg}")
                    raise Exception(error_msg)
    
    async def check_availability(self, date: str, time: Optional[str] = None) -> Dict[str, Any]:
        """
        Check if a date/time slot is available
        Args:
            date: Date in YYYY-MM-DD format
            time: Time in HH:mm format (optional)
        Returns:
            Availability status dict
        """
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/bookings/availability"
            params = {'date': date}
            if time:
                params['time'] = time
            async with session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    return data.get('data', {})
                else:
                    error_data = await response.json()
                    raise Exception(f"Availability API error: {error_data.get('error', 'Unknown error')}")
    
    async def send_email(self, booking_id: str) -> Dict[str, Any]:
        """
        Send booking confirmation email
        Args:
            booking_id: Booking ID
        Returns:
            Email sending status
        """
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/tools/send-email"
            async with session.post(url, json={'bookingId': booking_id}) as response:
                if response.status == 200:
                    data = await response.json()
                    return data
                else:
                    error_data = await response.json()
                    raise Exception(f"Email API error: {error_data.get('error', 'Unknown error')}")
    
    async def call_tool(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool via the tools API
        Args:
            tool_name: Name of the tool
            params: Tool parameters
        Returns:
            Tool execution result
        """
        print(f"🌐 [API_CLIENT] Calling tool '{tool_name}' with params: {params}")
        async with aiohttp.ClientSession() as session:
            url = f"{self.base_url}/api/tools/{tool_name}"
            print(f"🌐 [API_CLIENT] POST {url}")
            async with session.post(url, json=params) as response:
                data = await response.json()
                if response.status == 200 and data.get('success'):
                    print(f"✅ [API_CLIENT] Tool '{tool_name}' executed successfully")
                else:
                    error = data.get('error', 'Unknown error')
                    print(f"❌ [API_CLIENT] Tool '{tool_name}' returned failure: {error}")
                # Return the full parsed body on both success and failure so
                # fields like data.alternatives survive for the caller to use -
                # raising here would discard them.
                return data

