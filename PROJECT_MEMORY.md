# Project Memory

This file is persistent, cross-session context for this repo. Any agent (Claude or otherwise)
working in this codebase should read this file first, and append to the **Session Log** at the
bottom when it makes a non-trivial change, decision, or discovery. Keep entries short and dated.
Don't duplicate what git history already shows — record the *why*, not the diff.

## What this project is

"Restaurant Voice Booking Agent" (repo name on GitHub: `AI_Concierge`, local folder: `AI_Concierge`).
A full-stack voice-enabled restaurant table booking agent, originally built as a Vaiu AI SDE Intern
assignment. Customer speaks naturally to a voice agent, which collects booking details, checks
weather, and creates a booking with an email confirmation.

- **Author**: Anshuman Mishra
- **GitHub remote**: `Anshumanv28/AI_Concierge` (corrected 2026-10-31 — an older note here said
  `Vaiu-AI-task`, which doesn't match `git remote -v`; the README's CI badge had the same stale name
  and was fixed in the same commit)

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

- As of 2026-10-26, all times are explicitly anchored to Asia/Kolkata (IST) via `backend/utils/timezone.js`,
  independent of server OS timezone (previously an undocumented assumption — see Session Log).
- As of 2026-10-26, `customerName`/`customerEmail` are captured from the conversation; `"Guest"`/no-email is
  only a fallback if the customer declines (previously hardcoded/discouraged — see Session Log).
- As of 2026-10-26, booking `status` is auto-confirmed (`"confirmed"`) on successful creation — there is still
  no restaurant-approval step, just no more stuck-at-"pending" placeholder (see Session Log).
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

### 2026-10-31 — First real CI run failed; frontend's `npm ci` is unreliable, switched to `npm install`
- Pushed the two commits above, checked the resulting GitHub Actions run (`gh run view`). Backend and
  Agent jobs passed; **Frontend job failed** on `npm ci` with the exact same "Missing: yaml@2.9.1
  from lock file" `EUSAGE` error documented as already-fixed two entries below. Docker job never ran
  (depends on all three `needs:` jobs passing).
- **Root cause of the regression**: after fixing the lockfile once (regenerating inside
  `node:18-alpine` to match npm 10.8.2), I later ran plain `npm install` directly on the Windows host
  (npm v11.12.1) a couple of times to reinstall `node_modules` for local native dev/testing. Even with
  `package.json` unchanged, `npm install` on a different major npm version silently rewrote
  `package-lock.json` into a shape only self-consistent for npm v11 — re-breaking it for npm
  10.8.2's `npm ci`, which is exactly what both the Dockerfile and CI use. **Lesson**: once a lockfile
  has been pinned to match a specific Docker/CI npm version, never run plain `npm install` against it
  from a different npm version, even "just for local dev" — use `npm ci` locally too (it never
  rewrites the lockfile) or regenerate+reverify in the matching container every time.
- **Then discovered the deeper problem**: even regenerating correctly, cleanly, in an isolated
  `node:18-alpine` container with the *exact* Node/npm versions GitHub Actions itself resolves
  (confirmed identical: v18.20.8, npm 10.8.2, via `gh run view --log`) **still produced a lockfile
  that failed `npm ci` on a second independent clean-container verification** — first with a
  different `yaml` patch (1.10.3 vs the earlier 1.10.2), then with `Invalid: lock file's
  typescript@7.0.2 does not satisfy typescript@4.9.5`. Neither `yaml` nor `typescript` is an actual
  dependency of this app (no `.ts` files, no YAML configs) — both are optional peer dependencies
  several layers deep in `react-scripts@5.0.1`'s (2022-era, now-deprecated) toolchain, and their
  exact resolved version depends on npm registry state *at resolution time*, not just the Node/npm
  version — i.e. genuinely non-reproducible across separate `npm install` runs, not something fixable
  by pinning versions harder.
- **Fix**: stopped trying to make `npm ci` work for the frontend specifically. Changed both
  `frontend/Dockerfile` and `.github/workflows/ci.yml`'s frontend job from `npm ci` to plain
  `npm install`, which tolerates this class of drift instead of hard-failing on it. Verified clean in
  an isolated container (fresh `npm install` + `CI=true npx react-scripts build`, both from scratch)
  and with a full `docker build` of the real `frontend/Dockerfile`. **Backend's `npm ci` is untouched
  and still used** — its dependency tree is small and clean with no such optional-peer instability,
  and it already passed in the real CI run.
- Did not touch `frontend/package-lock.json` again this round — with `npm install` in place of
  `npm ci`, the committed lockfile is now advisory/best-effort rather than strictly authoritative, so
  there's no more "one correct snapshot" to chase for this particular dependency tree.
- **Next step**: push this fix and re-check the Actions run to confirm the frontend job (and the
  previously-never-reached Docker build+push job) actually go green.

### 2026-10-31 — Fixed both previously-documented "Known Issues": typed chat now works, booking card renders
- User asked to fix the two gaps noted in the entry below ("Containerized the app...") right after
  they were documented. Both are now fixed and **verified with a real, complete, text-driven
  booking** — not just code review. Both "Known Issues" bullets have been removed from the README
  since they no longer apply; this entry is the historical record of what was wrong and how it was
  fixed.
- **Fix 1 — typed messages now actually drive the LLM** (`agent/core/voice_agent.py`,
  `_on_data_received`'s `user_message` branch). Voice turns work automatically because
  `AgentSession` runs its own STT→LLM→TTS pipeline; a data-channel text message never enters that
  pipeline at all, so `on_user_turn_completed` alone (which only logs/forwards a transcript to the
  frontend — see `agent/agent.py`) was never going to produce a reply. Added an explicit
  `self._session.generate_reply(user_input=text)` call right after `on_user_turn_completed`, mirroring
  what `on_option_selected` already did for the logging/transcript half (via `agent.py`'s
  `MockMessage` pattern — used `types.SimpleNamespace(content=text)` here instead of defining a
  second throwaway class). `generate_reply(user_input=...)` is the officially supported
  `AgentSession` API for exactly this ("generate a reply as if the user said this") — found via
  `livekit/agents/voice/agent_session.py`.
- **Fix 2 — `BookingConfirmation` now renders** (`frontend/src/hooks/useLiveKit.js`,
  `frontend/src/App.js`, `agent/core/voice_agent.py`, `agent/utils/frontend_communicator.py`). This
  was a two-sided gap: the agent never sent booking data to the frontend at all (no
  `send_booking_confirmation`-equivalent existed in `FrontendCommunicator`, unlike
  `send_transcript`/`send_options`/`send_state_update`/`send_current_speech`), *and* `App.js`'s local
  `booking` state was never wired to receive it even if it had. Fixed both ends:
  - Added `FrontendCommunicator.send_booking_confirmation(booking)`, sending
    `{type: 'booking_confirmed', booking}` over the data channel (same pattern as the other
    `send_*` methods).
  - `voice_agent.py`'s `create_booking`, on success, now calls it — flattening the backend's
    `{booking: {...with _id...}, emailStatus}` shape into what
    `frontend/src/components/BookingConfirmation.js` actually reads (`bookingId` instead of `_id`,
    plus `numberOfGuests`/`bookingDate`/`bookingTime`/`cuisinePreference`/`seatingPreference`/
    `status`/`weatherInfo` already matched the Mongoose doc's field names 1:1).
  - **Moved `booking` state into `useLiveKit.js`** (previously lived in `App.js` via a bare,
    never-written-to `useState(null)`) so it follows the same ownership pattern as every other
    agent-driven value (`transcript`, `options`, `currentSpeech`, etc. all already live in the hook,
    not in `App.js`). Added a `data.type === "booking_confirmed"` branch to the existing
    `RoomEvent.DataReceived` switch, reset `booking` to `null` in `disconnect()` alongside the other
    session-scoped state, and returned it from the hook. `App.js` now destructures `booking` from
    `useLiveKit()` instead of maintaining its own copy; removed the now-unused `useState` import.
- **Verified live, fully end-to-end**, not just compiled: restarted the whole native stack, connected
  with mic off (text-only, to keep the test deterministic), and ran a complete booking conversation
  purely by typing — "book a table for 2 tomorrow at 7pm, no name/email" → agent asked to confirm →
  confirmed → agent ran `check_availability` + `check_weather` tools and asked about seating → chose
  outdoor → agent called `create_booking` for real (hit the real backend, wrote to real MongoDB) →
  **`BookingConfirmation` card rendered** with the real booking ID, date (resolved correctly to
  2026-11-01 via the existing IST-anchored date tool), time, outdoor seating, and `confirmed` status.
  Screenshotted this and added it to the README (`docs/screenshots/booking-confirmation.jpg`) as a
  third real screenshot alongside landing/connected.
- Confirmed via agent log there were zero errors anywhere in this flow (no "Error sending booking
  confirmation to frontend", no tool failures) — a clean run, not a lucky one.

### 2026-10-31 — Fixed the "invalid int 32: object" data-channel send error (+ 2 more bugs it exposed)
- **User-reported symptom**: clicking Send on a typed chat message (or pressing Enter) showed
  `Error: Failed to send message: invalid int 32: object` in the UI. Found while testing text input
  during the containerization/screenshots work above.
- **Root cause (bug 1, frontend)**: `frontend/src/hooks/useLiveKit.js`'s `sendTextMessage` and
  `sendOptionSelection` both called `room.localParticipant.publishData(bytes, { reliable: true })`.
  In the installed `livekit-client@1.15.13`, `publishData`'s signature is
  `(data, kind: DataPacket_Kind, publishOptions?)` — the second argument must be the
  `DataPacket_Kind` enum (serialized as a protobuf `int32`), not an options object. Passing
  `{ reliable: true }` there is exactly what produced "invalid int 32: object" when the SDK tried to
  protobuf-encode it. **Fix**: import `DataPacket_Kind` from `livekit-client` and pass
  `DataPacket_Kind.RELIABLE` as the second argument at both call sites.
- **Root cause (bug 2, agent/Python)**: once the frontend send actually succeeded, the packet reached
  the agent but crashed it — `core/voice_agent.py`'s `room.on("data_received", ...)` wrapper was
  declared as `def on_data_received(data, participant, kind, topic)`, but the installed
  `livekit-rtc` (bundled with `livekit-agents==1.8.10`) emits a single `DataPacket` dataclass object
  (`.data`/.kind/.participant/.topic` fields), not four positional args — `TypeError: missing 3
  required positional arguments`. **Fix**: changed the wrapper to take one `data_packet` arg and
  unpack its fields when forwarding to `_on_data_received`.
- **Root cause (bug 3, agent/Python)**: with bug 2 fixed, a third latent bug surfaced:
  `_on_data_received`'s `participant and not participant.is_local` check raised
  `AttributeError: 'RemoteParticipant' object has no attribute 'is_local'` — that attribute no
  longer exists on `RemoteParticipant` in the installed SDK version. Since `DataPacket.participant`
  is typed `RemoteParticipant | None` (None only for server-SDK-sent data), a truthy value is always
  remote by construction — simplified the check to just `if participant:`.
- **Pattern across all three**: every one of these is `livekit-client`/`livekit-rtc` API drift — the
  code was written against an older SDK version, and `package.json`/`requirements.txt` both pin with
  open ranges (`^1.15.1`, `>=1.3.6`) that happily installed much newer SDKs. Worth keeping in mind
  for any other LiveKit SDK call in this codebase that hasn't been exercised recently.
- **Verified live**, not just compiled: restarted backend+agent+frontend natively, connected via
  browser with mic deliberately disabled (to avoid stray ambient-audio STT noise polluting the test),
  sent a typed message, and confirmed via browser console (`✅ Text message sent to agent`) and the
  agent log (`📨 [AGENT] Received user message via data channel: ...`, no traceback) that the full
  round trip now works cleanly. Also reconfirmed `frontend/src/hooks/useLiveKit.js` still builds
  clean (`CI=true npx react-scripts build`) after the change.
- **What's still NOT fixed** (first bullet of README's "Known Issues", unchanged from this morning's
  entry below): the agent receiving the message without crashing is as far as this round went —
  `_on_data_received`'s `user_message` branch still only `print()`s the text and does not forward it
  into the LLM session/`on_user_turn_completed` the way `option_selected` does via `MockMessage` in
  `agent/agent.py`. So typed messages no longer error, but still don't produce a reply. That's a
  separate, larger piece of work (needs figuring out the right way to inject a synthetic user turn
  into a running `AgentSession` and trigger generation) — out of scope for "fix this error."

### 2026-10-31 — Containerized the app, added CI/CD, added real README screenshots
- **Docker**: added `backend/Dockerfile` (node:18-alpine), `agent/Dockerfile` (python:3.11-slim,
  pre-fetches the Silero VAD model at build time via `python agent.py download-files` so it doesn't
  need network access on first run), `frontend/Dockerfile` (multi-stage: CRA build → nginx:alpine,
  `REACT_APP_*` vars passed as build ARGs since CRA bakes them in at build time, not runtime), plus
  `.dockerignore` per service and `frontend/nginx.conf` (SPA fallback, though the app has no router
  currently so it's not load-bearing yet). Root `docker-compose.yml` wires `mongodb` + `backend` +
  `agent` + `frontend` together; `MONGODB_URI`/`BACKEND_URL` are overridden via compose
  `environment:` to point at service names instead of `localhost` for the two backend-facing
  services, while the frontend's `REACT_APP_*` build args stay as externally-reachable URLs (the
  browser talks to LiveKit/the backend directly, not through the compose network) — read from
  `frontend/.env` via `docker compose --env-file frontend/.env up --build`. All three images were
  actually built locally and verified working (not just written and assumed correct).
- **Found and fixed a real, pre-existing bug while validating the Docker builds**:
  `frontend/package-lock.json` was out of sync with `frontend/package.json` (stale `tailwindcss`/
  `postcss`/`autoprefixer` devDependency entries that had been removed from `package.json` but never
  re-synced into the lockfile — leftover from some earlier, since-reverted styling approach, given
  the app now uses inline styles via `utils/styles.js`). `npm ci` correctly rejected this, which
  matters because both the new Dockerfile and the new CI workflow use `npm ci`. Regenerated the
  lockfile — **had to do it inside a `node:18-alpine` container**, not on the host, because the host
  had Node v24/npm v11 while the Docker image (and CI) use Node 18/npm ~10.8, and those versions
  resolve an optional peer dependency (`yaml`, under some package's `peerDependenciesMeta`)
  differently, producing a lockfile npm 10 would again reject. **Takeaway**: always regenerate
  lockfiles for a project using the same Node major version as its Dockerfile/CI, not whatever's
  on the host.
- **GitHub Actions** (`.github/workflows/ci.yml`): `backend`/`frontend`/`agent` jobs install deps and
  validate (frontend runs a real `react-scripts build`, confirmed clean with no lint warnings first
  via `CI=true npx react-scripts build` locally — that's why the workflow doesn't need `CI=false`).
  A `docker` matrix job builds all three images on every push/PR, and additionally pushes them to
  `ghcr.io/<owner>/<repo>-{backend,agent,frontend}` (tags `latest` + short SHA) on merges to `main`,
  using `docker/metadata-action` (handles GHCR's lowercase-name requirement automatically) and the
  built-in `GITHUB_TOKEN` — no extra secrets needed. Frontend image build args in CI default to
  placeholder URLs unless repo Variables `REACT_APP_LIVEKIT_URL`/`REACT_APP_BACKEND_URL` are set.
- **README**: added a CI badge, a "Screenshots" section (`docs/screenshots/landing.jpg` and
  `connected.jpg`, both real captures from a live local run — see below), a "Run with Docker
  Compose" section, and new "Known Issues" + "CI/CD" sections.
- **Discovered two real, separate app bugs while trying to get a clean booking-confirmation
  screenshot** (left unfixed — out of scope for this round, noted in README's new "Known Issues"
  section too):
  1. **Typed chat input is a dead end.** `frontend/src/hooks/useLiveKit.js`'s `sendTextMessage` sends
     a `type: "user_message"` payload over the LiveKit data channel; `agent/core/voice_agent.py`'s
     `_on_data_received` receives it and only `print()`s it (comment says "let
     `on_user_turn_completed` handle it", but nothing actually routes a typed message into
     `on_user_turn_completed` or `session.generate_reply` the way `option_selected` messages do via
     the `MockMessage` pattern in `agent/agent.py`). So only real voice/STT input actually drives the
     conversation today. Also hit a separate, narrower bug here: sending via the Enter key (vs
     clicking Send) triggered a frontend error "Failed to send message: invalid int 32: object" —
     looked like a `room.localParticipant.publishData(...)` argument-shape mismatch against the
     installed `livekit-client` version, didn't dig further.
  2. **`BookingConfirmation` never renders.** `frontend/src/App.js` has `const [booking, setBooking]
     = useState(null)` but nothing ever calls `setBooking` with real data (only resets it to `null`
     on disconnect) — so the confirmation card is permanently dead code in the current build,
     regardless of whether a booking actually succeeds on the backend.
- **Screenshots were captured from a genuinely working voice conversation**, not staged: connected
  via the browser, and — because Claude-in-Chrome's automated environment had *some* live audio
  input available — the mic picked up real ambient speech/noise that LiveKit STT transcribed, and
  the agent correctly responded through a real multi-turn exchange (greeting → asked guest count →
  confirmed count → asked for time), proving the voice pipeline genuinely works end-to-end with the
  now-configured LiveKit/OpenAI credentials. Reconnected to a fresh session and disabled the mic
  before taking the final saved screenshots, for a clean, reproducible shot rather than the noisy
  transcript.
- Verified MongoDB is already running as a Windows service (not freshly started) before any of this.
- **Next steps**: push the still-unpushed local commits (`c2c46d0`, `a9c3639`) plus this round's new
  files to `origin/main` if/when the user wants CI to actually run; optionally fix the two bugs
  above; optionally add real screenshot(s) of a completed booking once the booking-confirmation
  wiring is fixed.

### 2026-10-31 — All four accounts/credentials created; .env files filled in; ready to test live
- **Blocker from the entries below is now cleared.** Used browser automation (Claude in Chrome) to
  set up every missing account/key, then wrote `backend/.env`, `agent/.env`, `frontend/.env`
  (confirmed all three are still correctly gitignored — see `.gitignore` lines 154/224/240).
- **LiveKit Cloud**: signed in as Anshuman Mishra (Google OAuth) — an existing project called
  "Vaiu AI" (`p_5hokvmk4ge9`, region US) was already there from a prior session, zero agents
  deployed. Generated a fresh key pair (old key `APIAXu4zRBpJ2GE` has no retrievable secret) →
  `LIVEKIT_URL=wss://vaiu-ai-irpwqlk6.livekit.cloud`.
- **OpenAI**: same Anshuman Mishra Google account already has an OpenAI Platform account with
  several pre-existing keys (ARTEMIS, OCR-Agent, etc. — unrelated other projects). Created a new
  key named "AI_Concierge" for this repo.
- **OpenWeatherMap**: no OAuth option (email/password only), so per safety rules this one had to be
  the user's own action — user already had an account/key and pasted it in directly.
- **Gmail SMTP app password**: tried `anshumanmishra.v.2.8@gmail.com` first — Google blocked App
  Passwords ("setting not available for your account"), root cause being 2-Step Verification was
  off. Switched to `anshumanmishra.kratos@gmail.com` per user's direction; that account *also*
  initially blocked App Passwords, but the user enabled 2-Step Verification + a passkey on it live
  during the session, and the app password ("AI Concierge SMTP") became available immediately
  after. **Takeaway for future setup**: Gmail App Passwords require 2FA to already be on — if the
  "setting not available" message appears, check/enable 2-Step Verification first before trying
  other accounts. `EMAIL_USER` and `RESTAURANT_EMAIL` are both set to this same kratos address
  (no real separate restaurant inbox exists yet — confirmation emails will land in the same
  account that sends them). User can redirect `RESTAURANT_EMAIL` elsewhere later if wanted.
- **MongoDB**: turned out already running — it's installed as a Windows service (`MongoDB`,
  StartType Automatic, currently PID varies on reboot) listening on `127.0.0.1:27017`. No manual
  `mongod` start needed; `MONGODB_URI=mongodb://localhost:27017/restaurant-bookings` just works.
- **Safety-rule note for future sessions**: account creation and password entry are both on the
  Prohibited action list even when the user asks for "help setting up" an account — the assistant
  navigated to each provider's page and set up API keys (an allowed action once a session exists)
  but the user had to type their own passwords/2FA at each Google sign-in challenge.
- **Next step**: pick up with starting the three processes (`npm run backend:dev`, `npm run
  agent:dev`, `npm run frontend`) and running one real voice booking through the browser — verify
  name/email capture, `status: "confirmed"`, correct IST date/time, and a real confirmation email
  arriving at the kratos inbox.

### 2026-10-31 — Committed pending fixes; still blocked on missing accounts/credentials
- Committed the customer-identity/auto-confirmation/IST-anchoring work from the 2026-10-26 entry
  below as `a9c3639` (it had been sitting uncommitted in the working tree since then). The
  alternative-slot-suggestion commit `c2c46d0` is still local-only — not yet pushed to
  `origin/main` (branch is ahead by 2 commits now).
- Re-checked: `backend/.env`, `agent/.env`, `frontend/.env` still do not exist. The underlying
  blocker from 2026-10-27 is unchanged — LiveKit Cloud project, OpenAI API key, Gmail SMTP app
  password, and OpenWeatherMap key still need to be created from scratch before any `.env` can be
  filled in and a real full-stack voice test can run.
- **Next steps**: same as below — account/key setup first (README "LiveKit Cloud Setup", "API
  Keys Setup" sections, ~lines 109-138), then fill in the three `.env` files, then run the three
  processes and do one real voice booking end-to-end.

### 2026-10-26 — IN PROGRESS: blocked on missing secrets, need to run full stack end-to-end
- **Pick up here next session.** Code for the four core-flow fixes below (customer identity/email,
  auto-confirmation, IST anchoring) is done and statically verified, but NOT yet run live against
  the full stack (backend + agent + frontend) with a real voice booking.
- **Blocker found**: no `.env` file exists anywhere in the repo (`backend/.env`, `agent/.env`,
  `frontend/.env` all absent), and no `.env.example` either. None of `MONGODB_URI`,
  `OPENWEATHER_API_KEY`, `EMAIL_USER`/`EMAIL_PASS` (Gmail SMTP), `LIVEKIT_URL`/`LIVEKIT_API_KEY`/
  `LIVEKIT_API_SECRET`, or `OPENAI_API_KEY` are configured. See `README.md` "Environment Variables"
  section (~line 140 onward) for the exact required keys per component.
- **MongoDB**: `mongod` binary IS installed locally (`C:\Program Files\MongoDB\Server\7.0\bin\mongod`),
  but `mongosh` is not on PATH — can self-host a local Mongo instance for `MONGODB_URI`, no external
  account needed for that one.
- **LiveKit + OpenAI are hard blockers for a real voice test**: the agent process cannot start without
  LiveKit Cloud credentials and an OpenAI key, and the frontend needs the agent running to connect to
  a LiveKit room. Without these, "test a real booking end to end" can only be done by curl'ing the
  backend tool endpoints directly (simulating what the agent would send) — not a true full-stack test.
  Gmail SMTP app password is also needed for the real customer-email-delivery part of this round's
  fixes to be verifiable.
- **Next steps**: user to supply/create `backend/.env`, `agent/.env`, `frontend/.env` with the keys
  above (LiveKit Cloud + OpenAI + Gmail app password + OpenWeatherMap, per README), then start all
  three processes (`npm run backend:dev`, `npm run agent:dev`, `npm run frontend`) and run one real
  voice booking conversation through the browser to confirm: name/email get asked and captured,
  customer receives a real confirmation email, booking shows `status: "confirmed"` in the UI, and
  date/time resolve correctly.
- **2026-10-27 update**: confirmed with user that none of the accounts/credentials exist yet — this
  isn't just missing `.env` files, the actual LiveKit Cloud project, OpenAI API key, Gmail app
  password, and OpenWeatherMap key all need to be created from scratch before any `.env` can be
  filled in. Next session should start with account/key setup (see README "LiveKit Cloud Setup",
  "API Keys Setup" sections, ~lines 109-138) before attempting the full-stack run.

### 2026-10-26 — Customer identity/email, auto-confirmation, explicit IST anchoring
- **Not yet committed** as of this writing.
- **Customer identity + email** (`agent/prompts.py`, `agent/core/voice_agent.py`): the email-sending
  plumbing (`emailService.js` sending to `customerEmail`, `bookingTool.js` calling it) already worked —
  the real gap was `prompts.py` actively telling the LLM name/email were skippable, plus a separate bug
  where step 5 of "Conversation Flow" told the LLM to redirect the customer to "contact the restaurant
  directly" instead of actually calling `create_booking`/`send_email`, contradicting the Responsibilities
  list. Reworded the prompt so name/email are asked as a normal part of the flow (with a graceful decline
  fallback to "Guest"/no-email), and fixed the dead-end step. Wired the previously-dead
  `agent/utils/email_extractor.py` (`is_valid_email`/`extract_email`) into `create_booking` to normalize
  STT-mangled emails before forwarding them, returning an `emailWarning` for the LLM to ask the customer
  to repeat their email rather than silently sending a broken address. Also fixed
  `backend/routes/bookings.js` POST `/` never destructuring/passing `customerName` (non-voice-path,
  Postman/docs route only, but a real bug).
- **Auto-confirmation**: `status: "confirmed"` is now set on successful booking creation in both
  `backend/tools/bookingTool.js` and `backend/routes/bookings.js` (previously always `"pending"`, and
  `"confirmed"` was a schema enum value with zero write-paths anywhere in the codebase). No
  restaurant-approval step was ever implemented and none is added here — auto-confirm was chosen because
  there's no admin dashboard/human-in-the-loop in scope this round. Verified the only other code
  branching on `status` (`frontend/BookingConfirmation.js`'s badge styling) already had a `"confirmed"`
  branch, so no frontend change was needed.
- **Explicit IST anchoring** (new `backend/utils/timezone.js`): previously, `dateCheckTool.js`'s
  "what is today" logic used plain `new Date()` + local getters, silently depending on the server/
  container OS timezone being set to Asia/Kolkata — a real latent deployment bug (shifts "today" by 5.5
  hours on a UTC-default host). Separately, `routes/bookings.js`, `bookingTool.js`, and
  `slotFinder.js`'s `getBookingsForDate` all parsed `"YYYY-MM-DD"` strings via `new Date(dateStr)`, which
  the spec parses as UTC midnight, not IST midnight — it only ever "worked" because the same parse was
  applied consistently on both write and read. Added `toISTMidnightUTC()` (explicit `+05:30` offset) and
  `getISTNow()` (`Intl.DateTimeFormat` with `timeZone: "Asia/Kolkata"`, mirroring the one place explicit
  IST handling already existed — `emailService.js`) and routed all of the above through them. Deliberately
  did NOT merge `bookingDate`+`bookingTime` into one combined timestamp field — the exact-match day query
  and HH:mm slot math never needed the instant to be correct, only consistent, so that would have been a
  bigger change for no behavioral gain. Also added `timeZone: "Asia/Kolkata"` to
  `BookingConfirmation.js`'s `formatDate` so display doesn't depend on the viewer's browser timezone.
  `weatherService.js`'s and `emailService.js`'s own `new Date(...)` usages were checked and left as-is
  (forecast-timestamp math and an already-correct-instant `Date` object, respectively — out of scope).

### 2026-10-26 — Real alternative-slot suggestions on booking conflicts
- **Commit**: `c2c46d0` on `main` (not pushed to `origin/main` as of this writing).
- **Verified live** before committing: ran a throwaway local MongoDB + backend instance (not
  checked in) and curl'd `check-availability`, `create-booking`, `POST /api/bookings`, and
  `GET /api/bookings/availability` against seeded conflicting bookings — confirmed alternatives
  are correct, sorted by proximity, respect operating-hour boundaries near closing, and that
  cancelling a conflicting booking actually un-blocks the slot (the bugfix). Also found and fixed
  a route-ordering bug while testing: `GET /api/bookings/availability` was registered after
  `GET /api/bookings/:id`, so Express swallowed "availability" as an `:id` param and the route
  was unreachable — moved it earlier in `routes/bookings.js`.
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
