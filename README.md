# Restaurant Voice Booking Agent 🎙️

[![CI/CD](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml/badge.svg)](https://github.com/Anshumanv28/AI_Concierge/actions/workflows/ci.yml)
[![Node 18+](https://img.shields.io/badge/node-18%2B-339933.svg)](https://nodejs.org/)
[![Python 3.9+](https://img.shields.io/badge/python-3.9%2B-blue.svg)](https://www.python.org/downloads/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/licenses/ISC)

> **A voice-native AI agent that books restaurant tables through natural conversation — no forms, no menus, no rigid dialogue tree.** A customer talks to it like a host; the LLM decides what to ask, when to check real data, and when to act.

---

## Screenshots

**Landing + chat history** — past conversations from this browser, listed and clickable; no login system, so history is scoped anonymously via a local id rather than an account.

![Landing screen with chat history](docs/screenshots/chat-history.png)

**Live voice session** — real-time mic equalizer, live transcript, typed-chat fallback. The mic automatically turns on/off as the conversation hands off between customer and agent.

![Connected voice session](docs/screenshots/connected.png)

**Booking confirmed** — a real booking created end-to-end through the conversation above, rendered the moment the agent calls `create_booking`.

![Booking confirmation](docs/screenshots/booking-confirmation.png)

**Past conversation** — any chat stays visible, read-only, after the call ends — click back into it from the landing page's history list any time.

![Past conversation view](docs/screenshots/past-conversation.png)

---

## What is this?

This is an **agentic system**, not a scripted chatbot: OpenAI GPT drives the entire conversation and decides for itself — turn by turn — which tool to call, based on function-calling definitions rather than a hand-coded state machine. An earlier state-machine implementation was deleted entirely once the LLM-driven flow replaced it.

```
Frontend (React)  ──LiveKit room──▶  Agent (Python)
     ▲                                    │
     │                      function-call tools (check date,
     │  data channel                      check weather,
     │  (booking_confirmed,               check availability,
     │   transcript, mic_control,         create booking,
     │   end_session, etc.)               send email, ...)
     │                                    ▼
     └────────────────────────── Backend (Node/Express) ──▶ MongoDB
                                           │
                                           ├──▶ OpenWeatherMap (live forecast)
                                           └──▶ NodeMailer (restaurant + customer email)
```

The LLM is the only thing deciding *what* happens next; the backend only executes well-defined tool calls and never makes conversational decisions itself.

A few things it's designed to get right, which matter more than the voice gimmick:

- **Grounded, not hallucinated.** When a requested time slot is taken, the backend computes real nearby open slots and hands them to the LLM as data — the model offers genuine alternatives instead of inventing plausible-sounding ones. Weather-based seating suggestions come from a live OpenWeatherMap call, not an LLM guess.
- **Real-time voice pipeline.** Built on LiveKit Agents (STT → LLM tool-calling → TTS), with a typed-chat fallback path that drives the same `AgentSession` so the agent behaves identically whether the input is speech or text.
- **Correctness under timezone/concurrency edge cases.** All date/time logic is explicitly anchored to IST regardless of host OS timezone, and booking-conflict checks are centralized in one shared module used by every code path that needs them.
- **Shipped, not just coded.** Three services (Node/Express API, Python/LiveKit agent, React frontend) are each Dockerized, wired together with Compose, and built/validated/pushed to GitHub Container Registry on every merge via GitHub Actions — see [CI/CD](#cicd).

---

## What's built

### Voice & conversation

- ✅ **Real-time voice pipeline** — LiveKit Agents (STT → LLM tool-calling → TTS)
- ✅ **Typed-chat fallback** — drives the exact same `AgentSession`, so text and voice behave identically
- ✅ **Mono design system** — a deliberate, distinctive UI (Space Mono/JetBrains Mono typography, one accent hue reserved for the live/active moment), not a generic pastel-gradient AI template
- ✅ **Agent-controlled microphone** — the mic turns off while the agent is talking/thinking and back on when it's the customer's turn, driven deterministically off the data channel's own transcript messages (manual override always available)
- ✅ **Agent-initiated call ending** — the call ends itself once the customer confirms they're done, no manual disconnect required

### Chat history

- ✅ **Persistent, browsable history** — every conversation is saved server-side and listed on the landing page
- ✅ **Browser-scoped, anonymous** — no login system exists, so history is tagged with a random id stored in the visitor's browser, not globally shared
- ✅ **Survives disconnect** — the transcript stays on screen, read-only, after a call ends instead of disappearing
- ✅ **Click to revisit** — any past conversation can be reopened from the landing page

### Booking logic

- ✅ **Real-data grounding** — live weather forecast, real computed alternative time slots, never LLM-invented
- ✅ **Conflict-aware availability** — centralized conflict check across every code path, up to 3 real nearby alternatives offered on a clash
- ✅ **Correctable mid-conversation** — a customer can correct their email or any detail and have the actual record (and any resend) reflect it
- ✅ **IST-anchored dates** — all date/time logic anchored to Asia/Kolkata explicitly, independent of host OS timezone

### Shipped

- ✅ **Dockerized** — per-service Dockerfiles + root `docker-compose.yml`
- ✅ **CI/CD** — GitHub Actions builds/validates all three services and pushes images to GHCR on every merge to `main`

---

## Engineering notes worth reading

A few real bugs found and fixed along the way, because the fixes are more interesting than the feature list:

- **An LLM few-shot leak caused every booking date to resolve to a hardcoded 2024 date.** The agent's own tool docstrings contained a literal example date ("if today is 2024-01-15, tomorrow is 2024-01-16") meant purely as illustration — the model pattern-matched and reused that literal value as the real `bookingDate` argument, even while correctly stating the real date in its spoken reply. Fixed by replacing every concrete example with an instruction to compute from the live `check_date` result.
- **The LLM would not reliably call its own "end the call" or "control the mic" tools — across two model tiers.** Tested `gpt-4o-mini` and full `gpt-4o`, with aggressive prompting (explicit few-shot examples, "tools are actions, not words" guardrails) — the model would write a goodbye message, sometimes even narrate `` `end_conversation()` `` as literal text, and never actually invoke the tool. The fix wasn't more prompting: mic control is now driven deterministically off the already-reliable transcript data-channel messages, and call-ending is decided by a **second, narrow LLM call** scoped to exactly one structured decision (forced tool call, required `reasoning` + `should_end` fields) — isolated from the primary conversational turn where tool-calling for this kind of self-referential action proved unreliable.
- **A naive `tool_choice="auto"` with one optional tool was still unreliable** — the dedicated classifier above first shipped as "any tool call = yes," which turned out biased toward calling the one available tool almost reflexively, including on a plain mid-task reply ("let me check the weather...") with zero farewell language. Fixed by forcing a single tool call with required `reasoning` + boolean `should_end` fields — the model can't skip straight to yes/no without explaining itself, which is the standard fix for calibrating a yes/no decision through function-calling.
- **A real React bug**: a flag mutated inside a `setTranscript(prev => ...)` updater and read on the very next line isn't reliable — React doesn't guarantee that updater runs synchronously. Found via a live timestamped-console-log test showing the signal silently dropped half the time. Fixed with a `ref` kept in sync instead.
- **A startup-crash bug caught before it shipped**: the OpenAI client for the end-call classifier was first created at module import time — but `agent.py` imports that module *before* calling `load_dotenv()`, so `OPENAI_API_KEY` wasn't set yet and the client constructor raised immediately. Fixed with lazy initialization.

---

## Quick Start

```bash
git clone https://github.com/Anshumanv28/AI_Concierge.git
cd AI_Concierge

# 1. Install everything (backend + frontend npm deps, agent pip deps)
npm run install:all

# 2. Create .env files in backend/, agent/, frontend/ — see Configuration below

# 3. Run all three processes
npm run backend:dev
npm run agent
npm run frontend
```

Backend on `http://localhost:5000`, frontend on `http://localhost:3000`.

---

## Configuration

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.9+
- **MongoDB** (local or MongoDB Atlas)
- **LiveKit Cloud** account (free tier: 1,000 minutes/month) — [cloud.livekit.io](https://cloud.livekit.io)
- **OpenAI API** key — [platform.openai.com](https://platform.openai.com)
- **OpenWeatherMap API** key — [openweathermap.org](https://openweathermap.org/api)
- **Gmail SMTP** app password (requires 2FA enabled first) — [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)

### Backend (`backend/.env`)

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/restaurant-bookings

OPENWEATHER_API_KEY=your_openweathermap_api_key
RESTAURANT_LOCATION=Mumbai

RESTAURANT_EMAIL=restaurant@example.com
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

PORT=5000
```

### Agent (`agent/.env`)

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

OPENAI_API_KEY=your_openai_api_key

BACKEND_URL=http://localhost:5000
```

### Frontend (`frontend/.env`)

```env
REACT_APP_LIVEKIT_URL=wss://your-project.livekit.cloud
REACT_APP_BACKEND_URL=http://localhost:5000
```

API keys and secrets never live in the frontend — LiveKit tokens are minted server-side specifically to keep secrets out of the browser.

---

## Usage

### Run natively

```bash
cd backend && npm run dev      # :5000
cd agent && python agent.py dev
cd frontend && npm start       # :3000
```

### Run with Docker Compose

```bash
docker compose --env-file frontend/.env up --build
```

`--env-file frontend/.env` is required because `REACT_APP_*` vars get baked into the frontend bundle at build time. The `backend`/`agent` containers get `MONGODB_URI`/`BACKEND_URL` overridden to point at the Compose network's service names; everything else comes from your `.env` files unchanged. If MongoDB is already running locally on 27017, stop it first or remove the `mongodb` service's `ports` mapping.

### API endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/bookings` | Create a booking |
| `GET` | `/api/bookings` / `/:id` | List / get a booking |
| `DELETE` | `/api/bookings/:id` | Cancel a booking |
| `GET` | `/api/weather/:date` | Weather forecast (`YYYY-MM-DD`) |
| `POST` | `/api/livekit/token` | Mint a LiveKit access token |
| `POST` | `/api/conversations` | Start a conversation history record |
| `GET` | `/api/conversations?anonId=` | List a browser's chat history |
| `GET` / `PATCH` | `/api/conversations/:id` | Get / update one conversation |

### Testing

```bash
curl http://localhost:5000/api/weather/2024-12-15

curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"numberOfGuests": 2, "bookingDate": "2024-12-15", "bookingTime": "18:30", "cuisinePreference": "Italian"}'
```

Manual: start all three services, open the frontend, click `connect_to_agent()`, speak or type a booking request, and verify the booking + email in MongoDB/your inbox.

---

## CI/CD

`.github/workflows/ci.yml` runs on every push and pull request to `main`:

- **backend** / **frontend** / **agent** jobs install dependencies and validate each service builds (the frontend job runs a full `react-scripts build`, which includes ESLint).
- A **docker** job builds all three images to confirm they're buildable, and on merges to `main` additionally pushes them to GitHub Container Registry as `ghcr.io/<owner>/<repo>-{backend,agent,frontend}`, tagged `latest` and with the commit SHA.

---

## Project structure

```
AI_Concierge/
├── backend/                 # Node.js + Express API
│   ├── models/               # Booking, Conversation (Mongoose)
│   ├── routes/                # bookings, weather, livekit, tools, conversations
│   ├── services/              # emailService, weatherService
│   ├── tools/                  # booking/date/email/weather tool wrappers
│   └── utils/                  # slotFinder, timezone
├── agent/                    # Python LiveKit agent
│   ├── core/voice_agent.py     # Function tools, deterministic reliability fallbacks
│   ├── tools/                  # Per-tool wrappers calling the backend
│   ├── utils/                  # frontend_communicator, email_extractor
│   ├── prompts.py              # System prompt
│   └── agent.py                # Entry point
└── frontend/                 # React + LiveKit Client SDK
    └── src/
        ├── components/          # VoiceInterface, Conversation, ChatHistory, BookingConfirmation
        ├── hooks/                # useLiveKit (LiveKit session + data channel + history persistence)
        └── utils/                # styles (mono design tokens), anonId, livekitConfig
```

---

## Roadmap

- Admin dashboard for booking management
- SMS notifications via Twilio
- Multi-language support
- Calendar integration with time slot management
- Booking analytics and reporting

---

## Tech stack

| Layer | Tool |
|---|---|
| Voice pipeline | LiveKit Agents (STT → LLM → TTS) |
| LLM | OpenAI GPT (`gpt-4o-mini`) |
| Backend | Node.js, Express, MongoDB/Mongoose |
| Frontend | React, LiveKit Client SDK |
| Weather | OpenWeatherMap |
| Email | NodeMailer (Gmail SMTP) |
| Containers | Docker, Docker Compose, GHCR |
| CI | GitHub Actions |

---

## License

ISC

---

**Made with 🎙️ by [Anshuman](https://github.com/Anshumanv28)**
