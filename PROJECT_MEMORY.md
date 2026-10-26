# Project Memory

This file is persistent, cross-session context for this repo. Any agent (Claude or otherwise)
working in this codebase should read this file first, and append to the **Session Log** at the
bottom when it makes a non-trivial change, decision, or discovery. Keep entries short and dated.
Don't duplicate what git history already shows — record the *why*, not the diff.

## What this project is

"Restaurant Voice Booking Agent" (repo name on GitHub: `Vaiu-AI-task`, local folder: `AI_Concierge`).
A full-stack voice-enabled restaurant table booking agent, originally built as a Vaiu AI SDE Intern
assignment. Customer speaks naturally to a voice agent, which collects booking details, checks
weather, and creates a booking with an email confirmation.

- **Author**: Anshuman Mishra
- **GitHub remote**: `Anshumanv28/Vaiu-AI-task`

## Architecture

Three parts, run as separate processes:

- **`backend/`** — Node.js + Express REST API, MongoDB (Mongoose) for storage.
  - `routes/` — `bookings.js`, `weather.js`, `livekit.js` (token generation), `tools.js`
  - `services/` — `emailService.js` (NodeMailer), `weatherService.js` (OpenWeatherMap)
  - `tools/` — booking/date/email/weather tool wrappers exposed to the agent via `routes/tools.js`
  - `utils/slotFinder.js` — shared conflict-check query + alternative-slot-finding logic, used by
    `dateAvailabilityTool.js`, `bookingTool.js`, and `routes/bookings.js` (added 2026-10-26, see
    Session Log — replaced 4 independently-duplicated conflict-check implementations)
  - `models/Booking.js` — booking schema
  - `postman/` — Postman collection + `API_DOCUMENTATION.md` for the REST API
- **`agent/`** — Python, LiveKit Agents Framework + OpenAI GPT for NLP.
  - `agent.py` — entry point (`python agent.py dev`)
  - `core/voice_agent.py` — main voice agent logic
  - `tools/` — `booking_tool.py`, `availability_tool.py`, `weather_tool.py`, `email_tool.py`,
    `today_date_tool.py`, `base_tool.py` — calls backend REST API via `utils/api_client.py`
  - `utils/` — `tool_executor.py`, `frontend_communicator.py`, `email_extractor.py`
  - `prompts.py` — system prompts for the LLM
- **`frontend/`** — React + LiveKit Client SDK.
  - `components/` — `VoiceInterface.js`, `Conversation.js`, `CurrentSpeech.js`,
    `BookingConfirmation.js`, `OptionSelector.js`
  - `hooks/useLiveKit.js` — LiveKit connection hook
  - `utils/livekitConfig.js`, `utils/styles.js`

Data flow: Frontend connects to LiveKit room → Agent (Python) handles voice conversation → Agent
calls Backend REST API (booking/weather/email tools) → Backend writes to MongoDB and sends email.

## Key decisions / non-obvious behavior (from README "Development Notes")

- All times stored in **Mumbai IST timezone**, no UTC conversion.
- `customerName` is hardcoded as `"Guest"` — simplified for demo, no customer identity capture.
- Booking `status` is always `"pending"` on creation — no auto-confirmation flow exists yet.
- Weather is fetched fresh per booking from OpenWeatherMap (no caching), used to suggest
  indoor/outdoor seating — not LLM-generated.
- Duplicate booking check is **exact** date+time match only — no time-window/buffer checking.
  As of 2026-10-26, a taken slot now returns up to 3 real alternative times (see Session Log).
- Email confirmation goes to `RESTAURANT_EMAIL` (the restaurant), **not** the customer. Booking
  still succeeds if the email send fails (logged, non-blocking).
- API keys/secrets must never live in the frontend — LiveKit tokens are minted server-side
  (`POST /api/livekit/token`) precisely to keep secrets out of the browser.

## Environment / running locally

- Needs `.env` in each of `backend/`, `agent/`, `frontend/` (see README for required keys:
  Mongo URI, OpenWeatherMap key, Gmail SMTP app password, LiveKit URL/key/secret, OpenAI key).
- `npm run install:all` installs backend+frontend npm deps and agent pip deps.
- Run three processes: `npm run backend:dev`, `npm run agent` (or `agent:dev`), `npm run frontend`.
- Backend on `:5000`, frontend on `:3000`.

## Known gaps / stated future work (from README)

- No admin dashboard for managing bookings.
- No customer-facing email confirmation (only restaurant gets emailed).
- No SMS, no multi-language, no calendar/time-slot management, no analytics.

## Deployment

Recent commit history shows a shift to AWS for deployment (see "deployment shift to AWS",
"deploy health check route added" commits) and later cleanup of committed LiveKit log/trace
JSON files that shouldn't have been tracked (chat_history/logs/traces under what looks like a
LiveKit recording/session path) — `.gitignore` was tightened afterward to stop re-adding these.

---

## Session Log

Newest entries at the top. Format: `### YYYY-MM-DD — short title` then a few bullet lines on
what changed/was decided/was discovered and why it matters for future work.

### 2026-10-26 — Real alternative-slot suggestions on booking conflicts
- **Feature**: when a requested slot is taken, the backend now computes up to 3 real nearby
  available times and the agent offers those instead of letting the LLM hallucinate alternatives.
  The prompt already told the LLM to "suggest alternative times" but no tool ever supplied any —
  this was the actual bug being fixed, not a net-new feature.
- **New file**: `backend/utils/slotFinder.js` — `getBookingsForDate(date)` (shared Mongo query,
  excludes cancelled bookings), `findNearestAvailableSlots(requestedTime, takenTimes)` (pure
  30-min-interval slot math), `getOperatingHours()` reads `RESTAURANT_OPEN_HOUR` /
  `RESTAURANT_CLOSE_HOUR` env vars (default 11/22 — these hours were previously only hardcoded in
  the now-deleted dead `flow_manager.py`, never in `prompts.py`).
- **Consolidated 4 independently-duplicated conflict-check implementations**
  (`dateAvailabilityTool.js`, `bookingTool.js`, `routes/bookings.js` POST, `routes/bookings.js`
  GET `/availability`) onto `slotFinder.js`. This fixed a real bug in the process: `routes/
  bookings.js`'s POST handler was missing the `status: { $ne: "cancelled" }` filter, so a
  cancelled booking could wrongly block a new booking at the same slot.
- **Non-obvious agent-side fix, required for the feature to actually work**: `agent/utils/
  api_client.py`'s `call_tool()` used to `raise Exception(...)` on any tool failure, which
  discarded the response body entirely — so `data.alternatives` from a failed `create_booking`
  call would never have reached the LLM even though the backend computed it correctly. Changed
  `call_tool()` to always return the parsed response and let callers branch on `success`.
  Similarly, `agent/core/voice_agent.py`'s `create_booking` failure branch used to return only
  `{'error': error}`, dropping `result['data']` — now it forwards `alternatives` when present.
  Without both fixes, alternatives would have worked for an explicit `check_availability` call
  but silently failed for the more common path (agent tries `create_booking` directly and hits
  the conflict there).
- **Deleted dead code**: `agent/conversation.py` and `agent/utils/flow_manager.py` — confirmed
  unreferenced from the live entry point (`agent/agent.py` → `prompts.py` + LiveKit
  `@function_tool()` tool calling); `flow_manager.py`'s own import of `conversation.py` was
  itself broken (`from conversation import ...` instead of a relative import), so it couldn't
  even have run if something had called it. The agent has always been fully LLM/prompt-driven,
  not state-machine-driven — these files were leftover from an earlier design.
- Updated `agent/prompts.py`: `check_availability` tool description and the Error Handling
  section now explicitly tell the LLM to read the `alternatives` array rather than inventing
  times. Also updated the matching docstrings in `agent/core/voice_agent.py` (`check_availability`
  and `create_booking`), since those docstrings are what LiveKit's `@function_tool()` actually
  turns into the OpenAI tool schema — `prompts.py`'s tool descriptions are prose for the LLM's
  general understanding, not the literal schema.

### 2026-10-26 — Memory file created
- Created this file by reading README.md, package.json, directory structure, and git log.
- No code changes made. Baseline snapshot of architecture/decisions as of commit `7628d89`
  ("Merge branch 'main' ... ok").
