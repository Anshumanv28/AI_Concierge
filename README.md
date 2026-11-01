# Restaurant Voice Booking Agent

[![CI/CD](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml/badge.svg)](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml)

A voice-native AI agent that books restaurant tables through natural conversation — no forms, no menus, no rigid dialogue tree. A customer talks to it like a host; the LLM decides what to ask, when to check real data, and when to act.

## Overview

This is an **agentic system**, not a scripted chatbot: OpenAI GPT drives the entire conversation and decides for itself — turn by turn — which tool to call (check a date, check the weather, check availability, create the booking), based on function-calling tool definitions rather than a hand-coded state machine. An earlier state-machine implementation was deleted entirely once the LLM-driven flow replaced it.

A few things it's designed to get right, which matter more than the voice gimmick:

- **Grounded, not hallucinated.** When a requested time slot is taken, the backend computes real nearby open slots and hands them to the LLM as data — the model offers genuine alternatives instead of inventing plausible-sounding ones. Weather-based seating suggestions come from a live OpenWeatherMap call, not an LLM guess.
- **Real-time voice pipeline.** Built on LiveKit Agents (STT → LLM tool-calling → TTS), with a typed-chat fallback path that drives the same `AgentSession` so the agent behaves identically whether the input is speech or text.
- **Correctness under timezone/concurrency edge cases.** All date/time logic is explicitly anchored to IST regardless of host OS timezone (`backend/utils/timezone.js`), and booking-conflict checks are centralized in one shared module (`backend/utils/slotFinder.js`) used by every code path that needs them, closing a class of bugs where duplicated conflict logic drifted out of sync.
- **Shipped, not just coded.** Three services (Node/Express API, Python/LiveKit agent, React frontend) are each Dockerized, wired together with Compose, and built/validated/pushed to GitHub Container Registry on every merge via GitHub Actions — see [CI/CD](#cicd).

## Demo

| Landing screen | Live voice session | Booking confirmation |
| --- | --- | --- |
| ![Landing screen](docs/screenshots/landing.jpg) | ![Connected voice session](docs/screenshots/connected.jpg) | ![Booking confirmation](docs/screenshots/booking-confirmation.jpg) |

## Architecture

```
Frontend (React)  ──LiveKit room──▶  Agent (Python)
     ▲                                    │
     │                      function-call tools (check date,
     │  data channel                      check weather,
     │  (booking_confirmed,               check availability,
     │   transcript, etc.)                create booking)
     │                                    ▼
     └────────────────────────── Backend (Node/Express) ──▶ MongoDB
                                           │
                                           ├──▶ OpenWeatherMap (live forecast)
                                           └──▶ NodeMailer (restaurant + customer email)
```

The LLM (via the agent process) is the only thing deciding *what* happens next; the backend only executes well-defined tool calls and never makes conversational decisions itself.

## Tech Stack

### Backend

- **Node.js** + **Express** — RESTful API
- **MongoDB** + **Mongoose** — Database and ODM
- **OpenWeatherMap API** — Live weather forecast data
- **NodeMailer** — Email service

### Agent (Python)

- **LiveKit Agents Framework** — Real-time voice pipeline + function-calling tool orchestration
- **OpenAI GPT** — Drives the conversation and all tool-call decisions
- **aiohttp** — Async HTTP client for the backend API

### Frontend

- **React** — UI framework
- **LiveKit Client SDK** — Voice interaction client

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

## Booking Flow

1. User opens frontend and clicks "Connect to Agent"
2. User speaks (or types): "I'd like to book a table"
3. Agent collects: number of guests, preferred date and time, cuisine preference, special requests
4. Agent calls the availability tool; if the slot is taken, the backend returns real nearby alternatives for the agent to offer
5. Agent fetches live weather for the booking date and suggests indoor/outdoor seating accordingly
6. Agent confirms all details with the user
7. Agent calls the booking tool — booking is created with `status: "confirmed"` (auto-confirmed on success)
8. Backend emails the restaurant, and the customer too if an email was captured
9. Agent confirms booking success to the user

## Key Implementation Details

### Booking Schema

- `bookingId`: MongoDB `_id` (auto-generated)
- `customerName` / `customerEmail`: Captured from the conversation; falls back to "Guest"/no-email only if the customer declines
- `bookingTime`: 24-hour format (HH:mm)
- `bookingDate`: Date object, explicitly anchored to IST midnight (`backend/utils/timezone.js`)
- `status`: `"confirmed"` on successful creation (auto-confirmed — no manual/restaurant approval step exists); `"cancelled"` via the cancel endpoint
- `weatherInfo`: `{ condition, temperature, description }`

### Conflict Handling

- Exact date + time match check, centralized in `backend/utils/slotFinder.js`
- On conflict, up to 3 real nearby open slots are computed and returned so the agent never has to guess

### Email Confirmations

- Sent to `RESTAURANT_EMAIL` always, and additionally to the customer if a valid email was captured during the conversation
- Booking succeeds even if the email send fails — errors are logged, never block the booking

### Weather Integration

- Real API data (not LLM-generated)
- No caching — fresh fetch for each booking
- OpenWeatherMap 5-day forecast API

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** (local or MongoDB Atlas)
- **LiveKit Cloud** account (free tier: 1,000 minutes/month)
- **OpenAI API** key
- **OpenWeatherMap API** key
- **Gmail SMTP** credentials (for email)

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

### Running the Application

#### Start Backend

```bash
npm run backend:dev
# or
cd backend && npm run dev
```

Backend runs on `http://localhost:5000`

#### Start Agent (Python)

```bash
npm run agent
# or
cd agent && python agent.py dev
```

#### Start Frontend

```bash
npm run frontend
# or
cd frontend && npm start
```

Frontend runs on `http://localhost:3000`

#### Run with Docker Compose

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

## Testing

### Manual Testing

1. Start all services (backend, agent, frontend)
2. Open frontend in browser
3. Click "Connect to Agent"
4. Speak (or type) a booking request
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

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **backend** / **frontend** / **agent** jobs install dependencies and validate each service builds
  (the frontend job runs a full `react-scripts build`, which includes ESLint).
- A **docker** job builds all three images (`backend/Dockerfile`, `agent/Dockerfile`,
  `frontend/Dockerfile`) to confirm they're buildable, and on merges to `main` additionally pushes
  them to GitHub Container Registry as `ghcr.io/<owner>/<repo>-{backend,agent,frontend}`, tagged
  `latest` and with the commit SHA.

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

## Future Enhancements

- Admin dashboard for booking management
- SMS notifications via Twilio
- Multi-language support
- Calendar integration with time slot management
- Booking analytics and reporting

## License

ISC

## Author

Anshuman Mishra
