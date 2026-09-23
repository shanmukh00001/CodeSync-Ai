# CodeSync AI — Master Architecture & Development Plan

**Status:** Draft v1. The architecture, database design, API design, and roadmap below are derived from the project's two planning documents. Anything describing the *current implementation state* (Section 19) is **self-reported, not yet verified against the actual codebase** — see the Verification Checklist immediately below. Update that section as soon as it's verified.

## Verification Checklist

**Confirmed by direct repo inspection:**
- Repo contains exactly two top-level folders: `backend/` and `frontend/`, on the `main` branch.
- **2 commits total** in the repo's history. No README, no top-level description.

**Not yet verified — needed to convert Section 19 from "reported" to "confirmed":**
- `backend/package.json` and `frontend/package.json`
- Backend entry point (`server.js` / `index.js` / `app.js`)
- Everything in `backend/models/`, `backend/routes/`, `backend/controllers/`, `backend/middleware/`
- Frontend router (`App.jsx` or equivalent) + `ProtectedRoute` / `PublicRoute` components
- Frontend `services/` (or equivalent API-calling code)
- The Room page/component

Until these are reviewed, treat every ✅ in Section 19 as "claimed," not "working."

## Contents

1. [Executive Summary](#1-executive-summary)
2. [Project Vision](#2-project-vision)
3. [Product Scope](#3-product-scope)
4. [MVP Definition](#4-mvp-definition)
5. [Post-MVP Features](#5-post-mvp-features)
6. [Architecture Review](#6-architecture-review)
7. [Recommended Final Architecture](#7-recommended-final-architecture)
8. [Database Design](#8-database-design)
9. [API Design](#9-api-design)
10. [Authentication and Security](#10-authentication-and-security)
11. [Real-Time Collaboration Architecture](#11-real-time-collaboration-architecture)
12. [Code Execution Architecture](#12-code-execution-architecture)
13. [AI Architecture](#13-ai-architecture)
14. [Frontend Architecture](#14-frontend-architecture)
15. [Backend Architecture](#15-backend-architecture)
16. [Complete Development Roadmap](#16-complete-development-roadmap)
17. [Phase-by-Phase Dependencies](#17-phase-by-phase-dependencies)
18. [Feature Priority Matrix](#18-feature-priority-matrix)
19. [Current State vs Required State](#19-current-state-vs-required-state)
20. [Testing Strategy](#20-testing-strategy)
21. [Deployment Strategy](#21-deployment-strategy)
22. [Risk Register](#22-risk-register)
23. [Version 1.0 Definition](#23-version-10-definition)
24. [Recommended Immediate Next Steps](#24-recommended-immediate-next-steps)

---

## 1. Executive Summary

CodeSync AI's actual differentiator is the data pipeline (activity → performance → AI insight), not the room or the editor — those are table stakes. The plan is sound in spirit but was originally scoped as 25 sequential phases, which is itself a risk for a project at this stage: too large to hold momentum against. This document compresses it to 7 stages with fewer, larger phases.

The two biggest architectural issues, independent of anything in the code: **JWT in localStorage** is an XSS-shaped hole that's cheap to close now and expensive to close later, and **the original roadmap treats security, error-handling, and testing as late phases** — that's a standard anti-pattern; they need to be a Definition-of-Done applied to every stage, not phases bolted on at the end. Both are addressed below.

## 2. Project Vision

**Value proposition:** not "LeetCode + chat + AI" — the thing worth building is that solving, attempting, and collaborating all feed one activity record, which feeds AI that says something a static stats page can't ("your Medium completion rate improved after you started pairing," not just "you solved 8 Medium problems"). That's a real product idea. It only becomes real once there's genuine activity data — which creates a chicken-and-egg problem worth naming now: **the AI layer will have nothing believable to say until either real users generate history, or synthetic solve/attempt data is seeded deliberately.** Plan for the latter; don't wait for the former.

**Target user:** treat this as a portfolio/learning project first, not a startup MVP. That changes several calls below — optimizing for "a reviewer can read the code and the demo works end-to-end" over "handles 10,000 concurrent rooms."

**Essential vs. unnecessary for v1:** essential = auth, problems, one working room with real-time code sync, one working code-execution path, minimal activity tracking. Unnecessary for v1 = chat, hints, AI room summaries, multi-language beyond 2, OT/CRDT, admin CRUD, notifications, theming.

## 3. Product Scope

MVP proves the full loop once, end to end, for one user, one problem, one room. Post-MVP adds breadth (more languages, more AI features, chat) and depth (better collaboration, better analytics) on top of a loop that already works. Don't build breadth before the loop closes — that's how "code execution" becomes the phase that never gets built.

## 4. MVP Definition

- Auth: register, login, logout, **httpOnly-cookie JWT** (not localStorage), session validated via `/api/auth/me`, not just token presence
- Problems: seeded (not admin-authored) set of ~20–30 problems, list + filter + search + detail page
- Rooms: create, join by link, leave, host-end, one active problem per room
- Real-time: Socket.IO room-scoped presence + throttled code broadcast (simple, last-write-wins — no OT/CRDT)
- Editor: CodeMirror 6, 2 languages (JavaScript + Python)
- Execution: Run + Submit via Judge0 (self-hosted or hosted free tier), against seeded test cases with a public/hidden split
- Activity: per (user, problem) status (`NOT_STARTED` / `ATTEMPTED` / `SOLVED`), attempts count, solved timestamp
- Profile: real stats computed directly from activity (no AI yet)
- Loading / error / empty states built **with** each feature above, not after

Everything else below is post-MVP.

## 5. Post-MVP Features

**Near-term (P1):** forgot password, settings that do something, dashboard "recently joined rooms," first AI feature (progress analysis only), a 3rd language, real deployment, first automated test suite.

**Mid-term (P2):** AI recommendations, AI hints (multi-level), AI room/session summaries, in-room chat, reconnection polish, responsive dashboard/profile.

**Later/optional (P3):** notifications, editor/theme preferences, OT/CRDT (only if 3+ simultaneous editors actually cause visible conflicts — most pair/small-group sessions never will), admin problem-authoring UI.

## 6. Architecture Review

**JWT stored in localStorage — change this.** Any XSS anywhere on the page (a compromised dependency, an unescaped render of user-generated content, a future feature that renders problem descriptions or AI text unsafely) reads `localStorage` with zero extra effort and gets a durable, replayable token. This is the single highest-leverage fix available, and it's cheap *right now* while the surface area is small. The fix isn't "add refresh-token rotation" (that's real complexity not needed yet) — it's simpler: keep the existing 7-day JWT design exactly as-is, just have the backend set it as an `httpOnly`, `Secure`, `SameSite=Lax` cookie on login/register instead of returning it in the JSON body, and clear it via a logout endpoint. That alone removes the theft vector. Trade-off: frontend fetch calls need `credentials: 'include'`, and CORS needs `credentials: true` with an explicit origin (no wildcard). Genuine refresh-token rotation is a reasonable P2 item, not a v1 blocker.

**"Protected routes only check token existence" is a direct consequence of the above, and moving to cookies forces the fix**, because the frontend literally can't read an httpOnly cookie to check it — it *has* to ask the backend. Add `GET /api/auth/me` (verifies the cookie server-side, returns the user or 401) and have `ProtectedRoute`/`PublicRoute` call it on mount instead of checking for a token's presence. This is also the correct place to handle expired/invalid tokens gracefully.

**UUID room IDs are fine, actually.** They're unguessable, which is the property that matters for a shareable-link room. The only real trade-off is UX if verbally sharing a code ("join room 7X4K9P") matters — if so, add a short human-readable `roomCode` alongside the UUID `_id`; if joining is always via a copied link, don't bother.

**Room participants: "embedded vs. separate" is not an either/or — it's two different concerns.** Embed a small `participants` array in the Room document for *live* socket-layer state (who's connected right now). That data is disposable and small. Don't build a full history collection on day one — for MVP, index `participants.userId` and query across rooms for "rooms joined" stats. Only add a dedicated `RoomParticipation` history collection once rooms start getting archived/deleted and durable per-user history is still needed for Profile stats and AI context — that's Stage 6, not Stage 4.

**`Problem.testCases` is missing a public/hidden split**, and this matters for security once execution exists: without an `isHidden` flag, "Run" and "Submit" either both leak grading tests in the API response, or there's no way to show sample tests at all. Add it now, in the schema, before code execution gets built on top of it.

**Naive full-code broadcast on every keystroke is fine for MVP** — LeetCode-style solutions are rarely more than a couple hundred lines, and OT/CRDT isn't needed for 2–3 people pairing. Two additions worth making now: throttle broadcasts client-side (send at most every ~150–250ms, not per-keystroke), and store the room's latest code snapshot server-side so a user who joins mid-session or reconnects gets synced immediately instead of seeing a blank editor.

**Code execution on the main Express process is correctly ruled out already — keep that rule.** See Section 12.

**MongoDB + Mongoose: keep it.** No strong reason to switch. The data here (flexible per-language starter code, variable-length examples/test arrays, tag lists) is comfortably document-shaped, and the auth system is already built on it — rewriting a working system for marginal relational benefit isn't justified. The discipline that matters is indexing (`Problem.slug`, `Problem.tags`, compound `UserActivity{userId,problemId}`, `Room.participants.userId`), not the database engine.

**Socket.IO: keep it too.** It gives reconnection, transport fallback, and a `.join(roomId)` room primitive that maps directly onto the actual "room" concept — reinventing that on raw `ws` isn't worth it at this scale. (Purpose-built realtime-collaboration services like Liveblocks/Ably exist if offloading the sync layer entirely is ever wanted — worth knowing about, not a recommendation to switch.)

**The original 25-phase roadmap treats security, testing, and UX states as late phases.** That's the biggest structural issue in the original plan. Loading/error/empty states and authz checks built after a feature "works" get built against a design that never accounted for them, and retrofitting is always more expensive than building in. Section 16 makes these Definition-of-Done criteria for every stage instead of standalone late phases.

## 7. Recommended Final Architecture

```
                        React Client (Vite)
                                │
                 HTTP (cookies) │  WebSocket (Socket.IO)
                                ▼
                        Express Backend
                                │
              ┌─────────────────┼──────────────────┬───────────────┐
              ▼                 ▼                  ▼               ▼
          MongoDB         Socket.IO server    Judge0 execution   LLM API
       (Atlas, indexed)   (same process,       service           (context builder
                            room-scoped)        (separate         → structured
                                                 container/host)   summary)
```

Frontend, backend, DB, and sockets stay as-is — nothing here demands a rewrite. Execution and AI are the two genuinely new subsystems, and both are deliberately kept **out-of-process** from the Express app (separate service/container) — the one non-negotiable architectural boundary in this whole plan.

## 8. Database Design

```js
// User — core identity. Keep small and stable; nothing high-churn lives here.
User {
  _id
  name
  email          // unique, lowercase, indexed
  passwordHash
  nameChangedAt: Date | null   // enforce one-time rename server-side, not just UI
  createdAt, updatedAt
}

// PasswordReset — separate collection: ephemeral, high-churn, needs TTL expiry.
// Embedding this in User would bloat the one document touched on every request.
PasswordReset {
  _id
  userId (ref, indexed)
  tokenHash        // hash the token; never store it raw
  expiresAt (TTL index)
  used: Boolean
  createdAt
}

// Problem — the curated content set. Seeded via script for v1, not an admin UI.
Problem {
  _id, title, slug (unique, indexed)
  difficulty: enum[Easy, Medium, Hard]
  description, examples[], constraints[]
  tags: [String]              // indexed for filtering
  starterCode: { javascript, python }
  testCases: [{ input, expectedOutput, isHidden: Boolean }]   // public/hidden split
  createdAt
}

// UserActivity — ONE doc per (user, problem), upserted. This is the fix for
// "avoid duplicate/inconsistent data": there is exactly one row that can be true
// per user+problem, not a growing log that has to be reconciled.
UserActivity {
  _id
  userId (ref, indexed), problemId (ref, indexed)   // unique compound index
  status: enum[NOT_STARTED, ATTEMPTED, SOLVED]
  attempts: Number
  language: String                 // last used
  timeSpentSeconds: Number          // client-reported, approximate — label as such in UI
  firstAttemptAt, solvedAt: Date | null
  roomId: ObjectId | null           // set if solved during a room session
  updatedAt
}

// Room — live session state only.
Room {
  _id
  host (ref User)
  participants: [{ userId, joinedAt, leftAt, role }]   // current/live, not history
  problemId (ref), status: enum[ACTIVE, COMPLETED, CLOSED]
  language, code: String            // latest snapshot, for reconnect/late-join sync
  createdAt, updatedAt, endedAt
}

// RoomParticipation — don't build in Stage 4. Add in Stage 6, when Profile
// needs durable room history that survives room deletion/archival.
RoomParticipation {
  _id
  userId (ref, indexed), roomId (ref), problemId (ref)
  role: enum[host, participant]
  joinedAt, leftAt
  outcome: enum[SOLVED, LEFT_UNSOLVED, ROOM_CLOSED]
}

// Submission — append-only. Only makes sense once code execution exists (Stage 5),
// not before — there's nothing meaningful to log until there's a real verdict.
Submission {
  _id
  userId (ref), problemId (ref), roomId: ObjectId | null
  code, language
  verdict: enum[ACCEPTED, WRONG_ANSWER, RUNTIME_ERROR, TIME_LIMIT_EXCEEDED]
  runtimeMs, memoryKb
  createdAt
}
```

## 9. API Design

**Auth** — none of these need authorization beyond "is this a valid session":

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | — | create account |
| POST | `/api/auth/login` | — | authenticate, set httpOnly cookie |
| POST | `/api/auth/logout` | cookie | clear cookie |
| GET | `/api/auth/me` | cookie | validate session, hydrate frontend on load |
| POST | `/api/auth/forgot-password` | — (rate-limited) | request reset; **always returns the same generic response** whether or not the email exists — account enumeration prevention |
| POST | `/api/auth/reset-password` | reset token | consume token, set new password |

**Users**

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/users/profile` | cookie | name, email, member-since |
| PATCH | `/api/users/name` | cookie | rejects if `nameChangedAt` already set |
| PATCH | `/api/users/password` | cookie | requires current password |
| GET | `/api/users/stats` | cookie | aggregated counts from UserActivity, computed server-side |

**Problems**

| Method | Route | Auth | Purpose |
|---|---|---|---|
| GET | `/api/problems?difficulty=&search=&tags=&page=` | cookie | list, filtered |
| GET | `/api/problems/:slug` | cookie | detail, includes only non-hidden test cases |

**Progress**

| Method | Route | Auth | Purpose |
|---|---|---|---|
| POST | `/api/activity/attempt` | cookie | upsert status→ATTEMPTED, increment attempts |
| GET | `/api/activity/:problemId` | cookie | current status for this user |

**Rooms** — every route validates, in order: cookie valid → roomId well-formed → room exists → room is ACTIVE → requester is a participant/host as appropriate:

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/rooms` | cookie | body: `problemId`, `language`; creator becomes host |
| GET | `/api/rooms/:roomId` | cookie + participant | 403 if not a participant, 404 if room doesn't exist (don't leak which) |
| POST | `/api/rooms/:roomId/join` | cookie | validates ACTIVE status before allowing join |
| POST | `/api/rooms/:roomId/leave` | cookie + participant | |
| POST | `/api/rooms/:roomId/end` | cookie + **host only** | |

**Collaboration (Socket.IO events, not REST)** — socket handshake carries the same cookie; reject connection if the session check fails:

`join-room {roomId}` · `code-change {roomId, code, language}` (throttled client-side) · `leave-room {roomId}` · `disconnect` (grace period before treating as leave, to survive brief network drops)

**Execution**

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/execute/run` | cookie, rate-limited | ephemeral, not graded, not persisted |
| POST | `/api/execute/submit` | cookie, rate-limited | runs hidden tests too; on ACCEPTED, server (not client) writes UserActivity SOLVED + Submission |

**AI**

| Method | Route | Auth | Notes |
|---|---|---|---|
| GET | `/api/ai/insights` | cookie | cached; recomputed daily or on explicit refresh, not per page-load |

## 10. Authentication and Security

- **Token storage:** httpOnly/Secure/SameSite cookie, per Section 6 — treat as required before anything ships publicly.
- **Password reset — token vs. OTP:** use a single-use, hashed, short-TTL token delivered via an emailed link. Simpler to build than OTP (no SMS provider needed, only email is collected today), and it's the standard pattern. One detail that matters: **don't consume the token on the GET request that loads the reset page** — some corporate email scanners pre-fetch links automatically and would silently burn a real user's token. Consume it only on the POST that sets the new password. OTP is a reasonable upgrade later, not a v1 requirement.
- **Rate limiting:** register, login, forgot-password, and both execution endpoints — the actual brute-force and abuse surfaces.
- **CORS:** explicit origin allowlist + `credentials: true`, no wildcard, once cookies are in play.
- **Errors:** one centralized Express error-handling middleware, consistent `{ error: { message, code } }` shape, no stack traces in production responses.
- **Sockets:** authenticate at handshake using the session cookie; validate room membership server-side on every `join-room`/`code-change` — don't trust the client's claimed roomId without checking.
- **AI:** the model never gets raw DB access — only the structured JSON the backend builds (Section 13). Any user-supplied text that eventually reaches an AI prompt (e.g. future hints) should be treated as untrusted for prompt-injection purposes.
- **Secrets:** `MONGO_URI`, `JWT_SECRET`, `AI_API_KEY`, execution-service credentials — env vars only, never committed; keep a `.env.example` with keys but no values.

## 11. Real-Time Collaboration Architecture

**MVP, and a good place to stop:** Socket.IO room channels, simple last-write-wins broadcast, client-side throttle (~150–250ms), server holds the latest code snapshot on the Room document so late joiners and reconnects sync immediately instead of starting blank. Presence via `join-room`/`leave-room`/`disconnect` with a short grace period before treating a disconnect as a real leave (covers brief wifi drops without kicking someone from the room).

**What would justify OT/CRDT later:** genuinely simultaneous multi-cursor editing with 3+ people actively typing in the same region at once, where last-write-wins starts visibly clobbering keystrokes. Most 2–3 person pairing sessions never hit this. Don't build it speculatively — Yjs/Automerge-style conflict resolution is real complexity this project doesn't need until there's evidence it's needed.

## 12. Code Execution Architecture

Never run submitted code on the Express process.

*(Checked current status rather than relying on stale knowledge, since this specific space changes.)* **Judge0 CE is open-source, MIT-licensed, and free to self-host with no per-execution cost** (Docker/docker-compose, isolated via Linux namespaces + cgroups, 60+ languages) — the realistic MVP path. There's also a hosted free tier via RapidAPI (~50 executions/day) for building the Run/Submit UX before setting up hosting for the execution service itself. Worth flagging: **Piston**, which used to be the zero-setup free public API, closed its public endpoint to unauthenticated use as of Feb 2026 — still free and open-source to self-host, it just no longer offers the frictionless path it once did. Recommendation: self-hosted Judge0 CE as the target, RapidAPI's free tier as a bridge. *(Re-check current status before committing — this category moves.)*

Controls regardless of which is chosen: CPU/wall-clock timeout, memory cap, output-size cap (a program that prints gigabytes will hang the response otherwise), no network access inside the sandbox (verify it's actually enabled in config, don't assume the default), and rate limiting on `/run` and `/submit` per user.

## 13. AI Architecture

```
UserActivity + Submission (raw)
        │
        ▼
Backend aggregation  →  { totalSolved, difficultyProgress, topicPerformance, recentActivity }
        │
        ▼
AI context builder (only this structured JSON reaches the model — never raw DB access)
        │
        ▼
LLM API  →  AI Response  →  cached  →  Profile "AI Insights" section
```

**MVP AI feature: progress analysis only** (strengths/weak-areas narrative from real numbers). Recommendations, hints, and room summaries are P2, after there's enough real data for progress analysis to already feel credible.

**Keep deterministic analytics and AI interpretation visually and structurally separate.** Counts and percentages are computed by the backend and are just facts. The AI's job is the *prose interpretation* of those facts, not producing the numbers — feed it only the pre-aggregated JSON, instruct it explicitly not to state any number that isn't in the context given, and label that section of the UI as AI-generated. This is what prevents "AI hallucinates a stat that looks like real analytics" from becoming a trust problem.

**Cost control:** cache insights and recompute on a schedule (daily) or an explicit "refresh" button — not on every profile page view. Send aggregated summaries, not raw activity history, to keep context small.

## 14. Frontend Architecture

The proposed `src/{components,pages,routes,services}` structure is good — keep it, just use it consistently.

One addition: a shared API client wrapper (base URL, `credentials: 'include'` once cookies are in play, centralized 401 → redirect-to-login handling) instead of repeating fetch boilerplate across `services/`.

**Editor: CodeMirror 6** (`@uiw/react-codemirror` or the raw `@codemirror/*` packages), not Monaco. CodeMirror's bundle is a fraction of Monaco's size, it's meaningfully better on touch/mobile (the room is already the hardest thing to make responsive), and it's fully capable for a 2-language MVP. Monaco is the "closer to real VS Code" choice if that specific feel matters more than load time.

## 15. Backend Architecture

The proposed `controllers/middleware/models/routes/utils/config` structure is fine, keep it. Two additions: a single centralized error-handling middleware (Section 10) instead of ad hoc try/catch response shapes scattered across controllers, and a validation layer at the route boundary (`zod` or `express-validator`) so malformed input never reaches a controller.

## 16. Complete Development Roadmap

Compressed from 25 phases into 7 stages. Security/testing/UX-states are **not phases** — they're Definition-of-Done requirements applied inside every stage, per Section 6.

### Stage 1 — Foundation
*Depends on: nothing. Why now: everything else sits on top of auth.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 1.1 Architecture lock-in | This document, confirmed against real code | Section 19 verified |
| 1.2 Auth hardening | Cookie migration, `/api/auth/me`, expired/invalid token handling, rate limiting on auth routes | A stolen/expired cookie is rejected server-side, not just missing-checked client-side |
| 1.3 Route protection rewire | `ProtectedRoute`/`PublicRoute` call `/me` instead of checking token presence | Manually expiring a cookie logs the user out on next navigation |

### Stage 2 — User System
*Depends on: Stage 1.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 2.1 Real profile data | Replace hardcoded name/email/member-since with `/api/users/profile` | Stats fields stay placeholder until Stage 3/5 data exists — don't fake them |
| 2.2 Settings | Change name (server-enforced one-time), change password | |
| 2.3 Forgot password | Token+email flow, generic response (Section 10) | |

### Stage 3 — Core Product Data
*Depends on: Stage 1. Note: "mark SOLVED" here is provisional — real solve-verification depends on Stage 5 execution existing. Track ATTEMPTED now; treat SOLVED as stubbed/manual until Stage 5 closes the loop.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 3.1 Problems DB + seed | Schema incl. `isHidden` test split, seed script (not admin UI) | 20–30 real problems queryable |
| 3.2 Problems API | list/filter/search/detail | |
| 3.3 Dynamic dashboard + problem details | Wire to real API, loading/error/empty states built in, not after | |
| 3.4 UserActivity tracking | ATTEMPTED wiring only; SOLVED wiring flagged pending Stage 5 | |

### Stage 4 — Collaboration
*Depends on: Stage 3 (needs a real problem to attach a room to). Can run partly parallel with Stage 5.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 4.1 Room lifecycle | create/join/leave/end, authorization order from Section 9 | Non-participant gets 403, not room data |
| 4.2 Socket presence | join/leave events, room-scoped | |
| 4.3 Code sync | Throttled broadcast, server-held snapshot for reconnect/late-join | A user joining mid-session sees current code immediately |
| 4.4 (P2) Chat | | |

### Stage 5 — Coding Engine
*Depends on: Stage 3 (problems + test cases must exist).*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 5.1 Editor | CodeMirror 6, 2 languages, wired into Room | |
| 5.2 Run | Judge0 integration, ephemeral results | |
| 5.3 Submit | Hidden-test grading, writes Submission + UserActivity SOLVED | **Closes the Stage 3.4 gap** — SOLVED now means something real |

### Stage 6 — Intelligence
*Depends on: Stage 3 + Stage 5, and on there being actual accumulated activity — not just code-complete. Seed synthetic solve/attempt history if there are no organic users yet, so this stage is demoable.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 6.1 Aggregation | Extend `/api/users/stats` with topic breakdown | |
| 6.2 AI context builder | Structured JSON only, no raw DB access to the model | |
| 6.3 AI progress insights | Cached, labeled as AI-generated in UI | |
| 6.4 (P2) Recommendations, hints, room summaries | | |

### Stage 7 — Production Quality
*Depends on: everything. This is a hardening/verification pass, not the first time these concerns are addressed — see Section 6.*

| Phase | Tasks | Definition of Done |
|---|---|---|
| 7.1 Security re-review | Re-check every route against the Section 10 checklist | |
| 7.2 Testing pass | Fill gaps (Section 20), add the E2E happy path | |
| 7.3 Responsive pass | Dashboard/profile mobile; room stays desktop-first (Section 14) | |
| 7.4 Perf/cleanup | Dead code, console logs, indexes | |
| 7.5 Deploy | Section 21 | |
| 7.6 Final QA | Full journey test, run manually end to end | |

## 17. Phase-by-Phase Dependencies

```
Stage 1 ──▶ Stage 2 (name/email can go early; real stats wait on Stage 3)
   │
   └──────▶ Stage 3 ──┬──▶ Stage 4 ─┐
                       │            ├──▶ Stage 6 ──▶ Stage 7
                       └──▶ Stage 5 ┘
```

Stages 4 and 5 can genuinely overlap — rooms and the editor/execution path are independent until "solve inside a room" needs to work, at which point 5 needs to be far enough along for 4's Submit button to do anything. Stage 6 is the one place where "code complete" isn't the same as "ready" — it also needs time/volume of real (or seeded) activity data.

## 18. Feature Priority Matrix

| Priority | Features |
|---|---|
| **P0 — MVP** | Auth (cookie-based), route protection via `/me`, problems DB+API, room lifecycle, throttled code sync, 2-language editor, Run/Submit via Judge0, activity status tracking, real profile stats (no AI), loading/error/empty states, rate limiting + authz on rooms/execution |
| **P1 — right after** | Forgot password, functional settings, dashboard recent-rooms, AI progress insights, 3rd language, real deployment, first test suite |
| **P2 — advanced** | AI recommendations, AI hints, AI room summaries, chat, reconnection polish, responsive dashboard/profile |
| **P3 — optional/future** | Notifications, editor/theme preferences, OT/CRDT, admin problem-authoring UI |

## 19. Current State vs Required State

*Legend: **Reported** = claimed in the planning docs, unverified. **Confirmed** = checked directly against the repo.*

| Feature | Reported status | Verified? | Next action |
|---|---|---|---|
| Registration / Login / bcrypt / JWT generation | ✅ Done | **NO** | Share `authController` + `User` model |
| JWT storage (localStorage) | ✅ Done, self-flagged as risky | **NO** (mechanism self-disclosed) | Migrate per Section 10 |
| Protected routes | ✅ Done, checks token presence only (self-disclosed) | **NO** | Add `/me`, rewire per Stage 1.3 |
| PublicRoute | 🟡 "testing/integration" | **NO** | Share component |
| Logout + confirm modal | ✅ Done | **NO** | — |
| Dashboard / Profile / Settings UI | ✅ "basic version," acknowledged as hardcoded | **NO** | Confirm what's actually wired vs. static |
| Room page | 🟡 "basic placeholder" | **NO** | Share component |
| Backend room validation | 🟡 "developed, needs testing" | **NO** | Share room controller/routes/middleware |
| Room lifecycle, Problems DB/API, activity tracking, realtime, execution, AI | ⏳ Not started (self-reported) | N/A | Build per Stages 3–6 |
| Repo has only `backend/` + `frontend/` at root, `main` branch | — | **YES**, confirmed via GitHub | — |
| Total commit count: 2 | — | **YES**, confirmed | Adopt smaller, more frequent commits going forward |

## 20. Testing Strategy

Don't overbuild this for a portfolio-stage project. **Backend:** Jest + Supertest for auth, rooms, and problems routes — registration/duplicate email/wrong password/expired-invalid token for auth; create/join/invalid-id/nonexistent/unauthorized for rooms. **Frontend:** React Testing Library for `ProtectedRoute`/`PublicRoute` behavior and the problem list's filter/search — skip testing every presentational component. **End-to-end:** Playwright, but only 2–3 flows: signup→login→dashboard, create-room→join-room→see-code-sync, open-problem→run→submit. Enough to catch regressions without turning testing into its own multi-week phase.

## 21. Deployment Strategy

Backend needs a host with **persistent Node processes**, not serverless functions — Socket.IO's long-lived connections don't work on function-per-request platforms (a serverless-functions host will silently break real-time sync). Frontend can go anywhere static. MongoDB Atlas free tier is fine at this scale. Judge0, if self-hosted, needs its own small container/VPS separate from the main API process. Env vars (`MONGO_URI`, `JWT_SECRET`, `AI_API_KEY`, execution-service credentials) via the host's secret manager, never committed; production CORS locked to the actual frontend origin once cookies are in play.

## 22. Risk Register

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Real-time sync bugs (ordering, dupes) | Medium | High | Simple broadcast + throttle first; explicitly defer OT/CRDT (Section 11) |
| Code execution abuse (resource exhaustion, escapes) | Medium–High if public | Critical | Judge0 sandboxing + timeouts/memory caps + rate limits (Section 12) |
| JWT in localStorage | Low–Medium | High | Cookie migration (Section 10) |
| AI cost runaway | Medium | Medium | Cache/schedule insight generation, don't call per page-view |
| DB complexity creep (building collections before needed) | Medium | Medium (dev time) | Follow the phased additions in Section 8 — `RoomParticipation`/`Submission` are Stage 6/5, not day one |
| Scope creep from a 25-phase plan | High | High | Use the 7-stage compression in Section 16; ship v1.0 (Section 23) before adding past it |
| WebSocket/serverless hosting mismatch | Medium | High (realtime silently breaks) | Persistent-process host for backend (Section 21) |
| Current repo state unverified (2 commits, blocked inspection) | Confirmed now | Medium | Share code; adopt the Implemented/Tested/Integrated rule going forward |

## 23. Version 1.0 Definition

**CodeSync AI v1.0 is:** a user can register, log in (cookie-based session), browse a seeded set of ~20–30 problems, open one, create or join a room via link, see another participant's code changes sync in real time, run and submit code in 2 languages against real (Judge0-graded) test cases, and see their own solved/attempted stats on a profile page built from real activity data — no AI yet.

**Explicitly not v1.0:** any AI feature, chat, hints, room summaries, more than 2 languages, notifications, theming, OT/CRDT, admin problem authoring. All of Stage 6 and the P2/P3 rows in Section 18.

## 24. Recommended Immediate Next Steps

1. Work through the **Verification Checklist** at the top of this document — share/open those files so Section 19 can move from "reported" to "confirmed."
2. Once verified, revise Section 19 and flag anything broken, duplicated, or insecure found in the actual code.
3. Some work can start regardless of what verification turns up, since it's requirements-driven, not code-driven: seed the Problem collection, decide Judge0 self-hosted vs. RapidAPI free tier, do the cookie migration.
4. Hold off on Stage 3+ feature work until Stage 1 (auth hardening) is actually done — not "written," done per the Implemented/Tested/Integrated standard.

---
*Generated as a working draft — update the Verification Checklist and Section 19 as the real codebase is reviewed against this plan.*
