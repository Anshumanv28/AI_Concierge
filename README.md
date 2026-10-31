# Restaurant Voice Booking Agent

[![CI/CD](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml/badge.svg)](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml)

A full-stack MERN voice-enabled restaurant booking agent that allows customers to book tables through natural voice conversation. Built with LiveKit for voice interaction, OpenAI GPT for NLP, OpenWeatherMap for weather data, and NodeMailer for email confirmations.

## Screenshots

| Landing screen | Live voice session | Booking confirmation |
| --- | --- | --- |
| ![Landing screen](docs/screenshots/landing.jpg) | ![Connected voice session](docs/screenshots/connected.jpg) | ![Booking confirmation](docs/screenshots/booking-confirmation.jpg) |

## Features

- 🎤 **Voice Interaction**: Natural conversation using LiveKit Agents Framework
- 🤖 **AI-Powered**: OpenAI GPT for intelligent conversation handling
- 🌤️ **Weather Integration**: Real-time weather data from OpenWeatherMap API
- 📧 **Email Confirmations**: Automated booking confirmations via NodeMailer
- 🗄️ **MongoDB Storage**: Persistent booking storage with duplicate prevention
- ⚡ **Real-time**: Live voice conversation with instant responses

## Tech Stack

### Backend

- **Node.js** + **Express** - RESTful API
- **MongoDB** + **Mongoose** - Database and ODM
- **OpenWeatherMap API** - Weather forecast data
- **NodeMailer** - Email service

### Agent (Python)

- **LiveKit Agents Framework** - Voice agent infrastructure
- **OpenAI GPT** - Natural language processing
- **aiohttp** - Async HTTP client for backend API

### Frontend

- **React** - UI framework
- **LiveKit Client SDK** - Voice interaction client

## Project Structure

```
restaurant-voice-agent/
├── backend/           # Node.js + Express API
│   ├── config/        # Database configuration
│   ├── models/        # MongoDB models
│   ├── routes/        # API routes
│   ├── services/      # Business logic (weather, email)
│   └── middleware/    # Error handling
├── agent/             # Python LiveKit agent
│   ├── utils/         # API client utilities
│   └── agent.py       # Main agent entry point
├── frontend/          # React frontend
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom React hooks
│   │   └── utils/        # Utility functions
└── README.md
```

## Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** (local or MongoDB Atlas)
- **LiveKit Cloud** account (free tier: 1,000 minutes/month)
- **OpenAI API** key
- **OpenWeatherMap API** key
- **Gmail SMTP** credentials (for email)

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
# Install all dependencies
npm run install:all
```

Or install individually:

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# Agent (Python)
# Create venv in root (recommended for monorepo)
python -m venv .venv
.\.venv\Scripts\activate  # Windows
# source .venv/bin/activate  # Mac/Linux

# Install dependencies
pip install -r agent/requirements.txt
```

### 2. MongoDB Setup

#### Option A: MongoDB Atlas (Recommended)

1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a cluster and get your connection string
3. Update `MONGODB_URI` in backend `.env`

#### Option B: Local MongoDB

1. Install MongoDB locally
2. Start MongoDB service
3. Use `mongodb://localhost:27017/restaurant-bookings` as `MONGODB_URI`

### 3. LiveKit Cloud Setup

1. Sign up at [cloud.livekit.io](https://cloud.livekit.io) (free tier available)
2. Create a new project
3. Get your credentials:
   - **LIVEKIT_URL**: WebSocket URL (e.g., `wss://your-project.livekit.cloud`)
   - **LIVEKIT_API_KEY**: API key from dashboard
   - **LIVEKIT_API_SECRET**: API secret from dashboard

### 4. API Keys Setup

#### OpenAI API Key

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create an API key
3. Add to `agent/.env`

#### OpenWeatherMap API Key

1. Sign up at [openweathermap.org](https://openweathermap.org/api)
2. Get your free API key (1,000 calls/day)
3. Add to `backend/.env`

#### Gmail SMTP (for Email)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → App passwords
   - Create app password for "Mail"
3. Use your Gmail address and app password in `backend/.env`

### 5. Environment Variables

#### Backend (`backend/.env`)

```env
# MongoDB
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/restaurant-bookings

# Weather API
OPENWEATHER_API_KEY=your_openweathermap_api_key
RESTAURANT_LOCATION=Mumbai

# Email Configuration
RESTAURANT_EMAIL=restaurant@example.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# LiveKit (for token generation endpoint)
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Server
PORT=5000
```

#### Agent (`agent/.env`)

```env
# LiveKit Cloud
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Backend API
BACKEND_URL=http://localhost:5000
```

#### Frontend (`frontend/.env`)

```env
REACT_APP_LIVEKIT_URL=wss://your-project.livekit.cloud
REACT_APP_BACKEND_URL=http://localhost:5000
```

**Note**: API keys and secrets should NEVER be in the frontend. Tokens are generated securely by the backend.

**Note**: Create `.env` files in each directory (backend, agent, frontend) based on the `.env.example` files.

## Running the Application

### Start Backend

```bash
npm run backend:dev
# or
cd backend && npm run dev
```

Backend runs on `http://localhost:5000`

### Start Agent (Python)

```bash
npm run agent
# or
cd agent && python agent.py dev
```

### Start Frontend

```bash
npm run frontend
# or
cd frontend && npm start
```

Frontend runs on `http://localhost:3000`

### Run with Docker Compose

The whole stack (MongoDB + backend + agent + frontend) can also run in containers. You still need
`backend/.env`, `agent/.env` and `frontend/.env` populated first (see above) — the images don't
bundle any secrets.

```bash
docker compose --env-file frontend/.env up --build
```

Notes:

- `--env-file frontend/.env` is required because `REACT_APP_LIVEKIT_URL` and `REACT_APP_BACKEND_URL`
  get baked into the frontend bundle at build time, so Compose needs them for variable substitution
  (not just as runtime env vars).
- The `backend` and `agent` containers get `MONGODB_URI`/`BACKEND_URL` overridden to point at the
  `mongodb`/`backend` service names on the Compose network — everything else comes from your `.env`
  files unchanged.
- If you already have MongoDB running locally on port 27017 (as in local dev), either stop it first
  or remove the `mongodb` service's `ports` mapping in `docker-compose.yml`.
- Backend: `http://localhost:5000`, Frontend: `http://localhost:3000`.

## API Endpoints

### Bookings

- `POST /api/bookings` - Create a new booking
- `GET /api/bookings` - Get all bookings
- `GET /api/bookings/:id` - Get specific booking
- `DELETE /api/bookings/:id` - Cancel booking

### Weather

- `GET /api/weather/:date` - Get weather forecast for date (YYYY-MM-DD format)

### LiveKit

- `POST /api/livekit/token` - Generate LiveKit access token for frontend (optional)

## Booking Flow

1. User opens frontend and clicks "Connect to Agent"
2. User speaks: "I'd like to book a table"
3. Agent collects:
   - Number of guests
   - Preferred date and time
   - Cuisine preference
   - Special requests
4. Agent fetches weather for booking date
5. Agent suggests indoor/outdoor seating based on weather
6. Agent confirms all details
7. Agent creates booking (status: "confirmed", auto-confirmed on success)
8. Backend sends email confirmation to the restaurant, and to the customer if an email was provided
9. Agent confirms booking success to user

## Key Implementation Details

### Booking Schema

- `bookingId`: MongoDB `_id` (auto-generated)
- `customerName`: Captured from the conversation; falls back to "Guest" if the customer doesn't provide one
- `bookingTime`: 24-hour format (HH:mm)
- `bookingDate`: Date object, explicitly anchored to IST midnight (`backend/utils/timezone.js`)
- `status`: "confirmed" on successful creation (auto-confirmed - no manual/restaurant approval step exists); "cancelled" via the cancel endpoint
- `weatherInfo`: `{ condition, temperature, description }`

### Duplicate Prevention

- Exact date + time match check
- No time window checking
- Error: "That exact time slot is already booked"

### Email Confirmations

- Sent to `RESTAURANT_EMAIL` (not customer)
- Booking succeeds even if email fails
- Email errors are logged but don't block booking

### Weather Integration

- Real API data (not LLM-generated)
- No caching - fresh fetch for each booking
- OpenWeatherMap 5-day forecast API

## Testing

### Manual Testing

1. Start all services (backend, agent, frontend)
2. Open frontend in browser
3. Click "Connect to Agent"
4. Speak booking request
5. Complete conversation flow
6. Verify booking in database
7. Check email confirmation

### API Testing

```bash
# Test weather endpoint
curl http://localhost:5000/api/weather/2024-12-15

# Test booking creation
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "numberOfGuests": 2,
    "bookingDate": "2024-12-15",
    "bookingTime": "18:30",
    "cuisinePreference": "Italian",
    "specialRequests": "Window seat"
  }'
```

## Troubleshooting

### Backend Issues

- **MongoDB connection error**: Check `MONGODB_URI` and network connectivity
- **Weather API error**: Verify `OPENWEATHER_API_KEY` is valid
- **Email not sending**: Check Gmail app password and SMTP settings

### Agent Issues

- **LiveKit connection error**: Verify `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET`
- **OpenAI API error**: Check `OPENAI_API_KEY` and account credits
- **Backend API error**: Ensure backend is running on `BACKEND_URL`

### Frontend Issues

- **Connection failed**: Check LiveKit credentials in `.env`
- **Microphone not working**: Grant browser microphone permissions
- **No audio**: Check browser console for errors

## Development Notes

- All times are explicitly anchored to Asia/Kolkata (IST) via `backend/utils/timezone.js`, independent of the server's OS timezone
- Customer name/email are captured from the conversation; "Guest"/no-email is only a fallback if the customer declines
- Bookings are auto-confirmed on successful creation (status: "confirmed") - there's still no restaurant-approval step
- Weather data fetched fresh for each booking (no caching)

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **backend** / **frontend** / **agent** jobs install dependencies and validate each service builds
  (the frontend job runs a full `react-scripts build`, which includes ESLint).
- A **docker** job builds all three images (`backend/Dockerfile`, `agent/Dockerfile`,
  `frontend/Dockerfile`) to confirm they're buildable, and on merges to `main` additionally pushes
  them to GitHub Container Registry as `ghcr.io/<owner>/<repo>-{backend,agent,frontend}`, tagged
  `latest` and with the commit SHA.

## Future Enhancements

- Admin dashboard for booking management
- Customer email collection and confirmations
- SMS notifications via Twilio
- Multi-language support
- Calendar integration with time slot management
- Booking analytics and reporting

## License

ISC

## Author

Anshuman Mishra
