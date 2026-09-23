# CodeSync AI — Stage 10.0: AI Hints & Personalized Recommendations Architecture & Contract

> **Document Type:** System Architecture, Data Audit, Security & API Specification Contract  
> **Features:** 
> 1. AI Hints (On-Demand Socratic & Targeted Algorithmic Hints)  
> 2. Personalized Coding Recommendations (Analytics-Driven Hybrid Challenge Suggestions)  
> **Status:** Stage 10.0 — **Audit & Design Contract Only / No Application Code Modifications**  
> **Target Providers:** Google Gemini (`gemini-3.6-flash` / `gemini-2.5-flash`) & Decoupled `AIProvider` Interface  
> **Target Endpoints:**  
> - `POST /api/submissions/hint`  
> - `GET /api/users/recommendations`  

---

## 1. Executive Summary & Problem Statement

CodeSync AI features an authoritative C++ and multi-language execution engine, real-time room synchronization, personal developer analytics (Stage 8), and comprehensive AI code review (Stage 9). 

Stage 10 builds upon this foundation to introduce two complementary advisory intelligence features:
1. **On-Demand AI Hints (`POST /api/submissions/hint`):** When a developer is stuck on a challenge in either solo workspace or a live collaborative room, they need guidance without surrendering the learning experience. The hint system acts as a Socratic mentor: pinpointing logical blockers, suggesting invariants or algorithmic paradigms, and warning against pitfalls, while strictly avoiding direct solution generation or full code snippets.
2. **Personalized Coding Recommendations (`GET /api/users/recommendations`):** Developers practicing on CodeSync AI need tailored guidance on which challenges to tackle next. Recommendations must synthesize deterministic performance metrics (acceptance rates, difficulty distributions, topic coverage gaps) with optional AI pedagogical reasoning to produce actionable, relevant problem suggestions.

---

## 2. PART 1 — Current Data Audit

We audited the active MongoDB models, database collections, services, and execution pipelines.

### 2.1 Problem Model (`models/Problem.js` -> `problems` collection)

| Field | Type | Access / Scope | Persisted? | Safe for Gemini? | Transformation / Whitelist Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Public | Yes | Safe | String conversion (`String(_id)`). |
| `title` | `String` | Public | Yes | Safe | Direct pass-through. |
| `slug` | `String` | Public | Yes | Safe | Direct pass-through. |
| `description` | `String` | Public | Yes | Safe | Direct pass-through (plain text / markdown). |
| `difficulty` | `Enum` ("Easy", "Medium", "Hard") | Public | Yes | Safe | Direct pass-through. |
| `tags` | `[String]` | Public | Yes | Safe | Sanitized array of trimmed non-empty strings. |
| `constraints` | `[String]` | Public | Yes | Safe | Direct pass-through as bulleted strings. |
| `examples` | `[{ input, output, explanation }]` | Public | Yes | Safe | Whitelisted: only `input`, `output`, `explanation`. |
| `starterCode` | `Object` (`cpp`, `javascript`, etc.) | Public | Yes | Safe | Used for context if user code is empty. |
| `execution` | `{ functionName, parameters }` | Internal | Yes | Optional | Parameter signatures safe; functionName safe. |
| `outputComparator` | `Enum` | Internal | Yes | No | Unnecessary for hints; omit. |
| **`testCases`** | **`[{ input, expectedOutput, isHidden }]`** | **Strict Secret** | **Yes** | **STRICTLY PROHIBITED** | **Hidden test cases (`isHidden: true`) must NEVER reach Gemini. Visible test fixtures (`isHidden: false`) must only be exposed through `examples` or sanitized runner summaries.** |

---

### 2.2 User Model (`models/User.js` -> `users` collection)

| Field | Type | Access / Scope | Persisted? | Safe for Gemini? | Transformation / Whitelist Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `_id` | `ObjectId` | Private | Yes | Safe (Anonymous) | Never pass raw user ID to external prompt text. |
| `name` | `String` | Private / Profile | Yes | PROHIBITED | Strip; unnecessary PII. |
| `email` | `String` | Private | Yes | **STRICTLY PROHIBITED** | PII; must never leave backend boundary. |
| `password` | `String` (Bcrypt hash) | Secret | Yes | **STRICTLY PROHIBITED** | Must never leave database. |
| `activeRoom` | `String` | Internal | Yes | Safe | Used solely for room authorization checks. |
| `recentRooms` | `[ObjectId]` | Internal | Yes | Prohibited for Gemini | Used for local session navigation. |
| `solvedProblems` | `[{ problem: ObjectId, solvedAt: Date }]` | Authoritative | Yes | Safe (Aggregated) | Transformed into topic counts & difficulty totals. Raw ObjectIds projected to problem titles/tags. |

---

### 2.3 Submission Model (`models/Submission.js` -> `submissions` collection)

| Field | Type | Access / Scope | Persisted? | Safe for Gemini? | Transformation / Whitelist Rule |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `user` | `ObjectId` | Private | Yes | No | Filtered by authenticated session `req.userId`. |
| `problem` | `ObjectId` | Reference | Yes | Safe | Populated for title/difficulty/tags. |
| `room` | `ObjectId` (Nullable) | Reference | Yes | Safe | Distinguishes solo vs. collaborative room submissions. |
| `language` | `Enum` | Public | Yes | Safe | Normalized ("cpp", "javascript", "python", "java"). |
| `code` | `String` | User Asset | Yes | Safe | Transmitted only if explicitly provided in active on-demand request ($1 \le \text{length} \le 65,536$). |
| `status` | `Enum` ("Accepted", "Wrong Answer", etc.) | Public | Yes | Safe | Used in high-level execution summary. |
| `passedTestCases` / `totalTestCases` | `Number` | Public | Yes | Safe | Public numeric counts. |
| `runtimeMs` / `memoryKb` | `Number` | Public | Yes | Safe | Aggregated for performance metrics. |
| **`failedTestCase`** | **`{ input, expected, actual }`** | **Restricted** | **Yes** | **Conditional** | **If failed test was hidden (`isHidden: true`), inputs/outputs are null in DB and MUST NEVER be synthesized for Gemini.** |
| **`testResults`** | **`[testResultSchema]`** | **Restricted** | **Yes** | **PROHIBITED** | **Never sent to Gemini. Only high-level count `passedTestCases/totalTestCases` is sent.** |

---

### 2.4 Analytics Service Data (`services/analyticsService.js`)

| Derived Analytic Metric | Computation Source | Persisted? | Safe for Recommendation Input? |
| :--- | :--- | :--- | :--- |
| `solved.totalSolved` / `easy` / `medium` / `hard` | Deduplicated `user.solvedProblems` | No (Derived on-demand) | Safe & Essential |
| `submissions.total` / `accepted` / `wrongAnswer` / `acceptanceRate` | Aggregation over `Submission.find({ user })` | No (Derived on-demand) | Safe & Essential |
| `topics` (`[{ tag, solvedCount }]`) | Aggregated tag frequency from solved problems | No (Derived on-demand) | Safe & Essential |
| `activity.currentStreak` / `longestStreak` | UTC day continuity | No (Derived on-demand) | Safe |
| `performance.averageRuntimeMs` / `averageMemoryKb` | Filtered valid numeric measurements | No (Derived on-demand) | Safe |

---

## 3. PART 2 — AI Hint Requirements & Contract

### 3.1 Core Principles & Socratic Anti-Solution Guardrails
To prevent the hint feature from turning into an automated solution generator / cheat engine:
1. **No Complete Code Blocks:** The system prompt and output schema strictly forbid returning working function implementations, full algorithms in code, or copy-pasteable blocks.
2. **Socratic Tiering:** The hint focuses on *concepts*, *invariants*, *data structure selection*, *edge conditions*, and *small directional steps*.
3. **Structured Direction:** Each hint comprises:
   - `concept`: The core algorithmic principle or pattern (e.g., "Two-pointer sliding window", "Prefix sum difference", "Monotonic stack").
   - `observation`: What the current code or problem constraints reveal (e.g., "Notice $N \le 10^5$, which means an $O(N^2)$ nested loop will exceed the 2.0s time limit.").
   - `suggestedStep`: A focused, bite-sized next step (e.g., "Try maintaining the minimum value seen so far as you iterate through the array.").
   - `pitfallToAvoid`: Common mistake to watch out for (e.g., "Be careful with 32-bit integer overflow when calculating products.").
   - `hintLevel`: `"gentle"` (conceptual nudge), `"targeted"` (focusing on the user's specific logic blocker), or `"refinement"` (optimization/edge-case guidance).
4. **No Persistence:** AI hints are ephemeral and advisory. They are not stored as database records unless explicitly required for auditing.
5. **Strict On-Demand Trigger:** Hints are only invoked when the user clicks the "Get Hint" button. Zero background polling.

---

### 3.2 AI Hint Request & Response Contract

#### Endpoint Specification
- **Route:** `POST /api/submissions/hint`
- **Auth:** Protected by `protect` middleware (`req.userId` via secure HttpOnly cookie).
- **Rate Limit:** Dedicated `aiHintLimiter`: **Max 6 hint requests per minute per authenticated user** (`skipFailedRequests: true`).
- **Timeout:** 15 seconds with `AbortController` cancellation.

#### Request Headers & Body
```http
POST /api/submissions/hint HTTP/1.1
Content-Type: application/json

{
  "problemId": "66d0c24e4f1a2b001c9a8e10",
  "language": "cpp",
  "code": "#include <vector>\nusing namespace std;\n...",
  "roomId": "room-uuid-1234",
  "lastExecutionResult": {
    "status": "wrong_answer",
    "passedTestCases": 2,
    "totalTestCases": 5
  }
}
```

#### Input Validation Rules
- `problemId`: Required, valid 24-character hex ObjectId.
- `language`: Required, enum: `"cpp"`, `"javascript"`, `"python"`, `"java"`.
- `code`: Optional/Required string ($0 \le \text{length} \le 65,536$). If empty or starter code, hint provides foundational problem-solving intuition.
- `roomId`: Optional string. If provided:
  - Must exist in MongoDB.
  - User `req.userId` must be an active member of `roomDoc.users`.
  - Room status must **not** be `"CLOSED"`. If `status === "CLOSED"`, returns `400 ROOM_CLOSED`.
- `lastExecutionResult`: Optional object with whitelisted numeric/status fields. Secret test data is rejected.

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "hint": {
    "hintLevel": "targeted",
    "concept": "Hash Map for $O(1)$ Complement Lookup",
    "observation": "Your current nested loop scans the remainder of the array for each element, leading to $O(N^2)$ time complexity.",
    "suggestedStep": "Consider storing each number's index in a hash table as you iterate, and check if (target - current_value) has already been seen.",
    "pitfallToAvoid": "Ensure you do not match the same element at index i with itself.",
    "questionToConsider": "What data structure allows you to query whether a previous element exists in constant average time?"
  }
}
```

---

## 4. PART 3 — Personalized Recommendations Requirements & Contract

### 4.1 Hybrid Architecture Rationale
Why **Hybrid (Deterministic Metric Engine + AI Curated Reasoning)** is optimal:
1. **Deterministic Candidate Filtering (Authoritative & Fast):**
   - Candidate problems are queried from MongoDB `Problem` collection.
   - **Exclusion Filter:** Already-solved problems (`user.solvedProblems`) are excluded.
   - **Difficulty Progression Filter:** 
     - If user has $< 3$ Easy solved $\rightarrow$ Recommend Easy challenges in foundational topics (Arrays, Strings).
     - If user has $\ge 3$ Easy solved and high acceptance rate ($> 60\%$) $\rightarrow$ Introduce Medium challenges.
     - If user has recent Wrong Answer / TLE patterns in a topic (e.g. Dynamic Programming) $\rightarrow$ Surface foundational Medium problems in that specific topic.
2. **AI Pedagogical Reasoning (Curated Synthesis):**
   - Gemini receives *only* the user's aggregated summary (e.g., "Solved 8 Easy, 2 Medium; strong in Arrays; weak in DP; acceptance rate 45%") along with a short list of 5–8 eligible candidate problems (`_id`, `title`, `difficulty`, `tags`).
   - Gemini selects the top 3 recommendations and provides a personalized, 1-sentence *pedagogical rationale* for each (e.g., "Tackling 'Longest Substring' will help you practice two-pointer sliding window techniques after your work on Two Sum.").
3. **Deterministic Fallback:** If Gemini is unavailable or rate-limited, the endpoint immediately returns the deterministic top 3 candidates with rule-based rationales. **Zero downtime.**
4. **No Redundant Collections:** Uses existing `User`, `Problem`, and `Submission` collections. No new database tables.

---

### 4.2 Recommendation API Contract

#### Endpoint Specification
- **Route:** `GET /api/users/recommendations`
- **Method:** `GET` is chosen because retrieving recommendations is a safe, idempotent read operation parameterized by the authenticated user's session state.
- **Auth:** Protected by `protect` middleware (`req.userId`).
- **Rate Limit:** Max **10 requests per minute** per user.
- **Cache / Freshness:** Computed on-demand with fast deterministic DB queries.

#### Response Schema (`200 OK`)
```json
{
  "success": true,
  "data": {
    "profileSummary": {
      "totalSolved": 10,
      "primaryDifficulty": "Medium",
      "topTopics": ["Array", "Hash Table", "Two Pointers"],
      "focusArea": "Dynamic Programming"
    },
    "recommendations": [
      {
        "problemId": "66d0c24e4f1a2b001c9a8e10",
        "title": "Longest Substring Without Repeating Characters",
        "slug": "longest-substring-without-repeating-characters",
        "difficulty": "Medium",
        "tags": ["Hash Table", "String", "Sliding Window"],
        "reason": "Strengthens sliding window optimization patterns building on your hash table proficiency.",
        "matchType": "Skill Progression"
      },
      {
        "problemId": "66d0c24e4f1a2b001c9a8e22",
        "title": "Container With Most Water",
        "slug": "container-with-most-water",
        "difficulty": "Medium",
        "tags": ["Array", "Two Pointers", "Greedy"],
        "reason": "Provides practice with two-pointer greedy reductions to improve runtime efficiency.",
        "matchType": "Topic Reinforcement"
      },
      {
        "problemId": "66d0c24e4f1a2b001c9a8e35",
        "title": "Climbing Stairs",
        "slug": "climbing-stairs",
        "difficulty": "Easy",
        "tags": ["Dynamic Programming", "Math"],
        "reason": "Foundational introduction to 1D state transitions to build confidence in Dynamic Programming.",
        "matchType": "New Topic Exploration"
      }
    ],
    "generatedAt": "2026-09-17T14:30:00.000Z"
  }
}
```

#### Edge Cases & Empty States:
- **Brand New User (0 Solved, 0 Submissions):** Returns introductory Easy problems with `matchType: "Getting Started"`.
- **All Problems Solved:** Returns `{ recommendations: [], message: "You have solved all available problems in CodeSync AI! Great job!" }`.
- **AI Service Down / Unconfigured:** Falls back seamlessly to deterministic rule selection with standard rationales.

---

## 5. PART 4 — Privacy & Security Audit

### 5.1 Strictly Prohibited Data Boundaries

The following attributes are **strictly blocked** from entering any AI prompt payload:
```
[PROHIBITED FROM GEMINI / AI PROVIDERS]
├── 1. Hidden Test Cases (isHidden === true)
│   ├── hidden input
│   ├── hidden expected output
│   └── hidden execution diff
├── 2. User Credentials & PII
│   ├── passwords / password hashes
│   ├── email addresses
│   ├── user real names
│   ├── JWT tokens / cookies / session IDs
├── 3. Unrelated User Context
│   ├── submissions from other users in unrelated rooms
│   └── room chat / discussion histories from unrelated rooms
└── 4. Database Internals
    └── connection strings, internal server error stack traces
```

### 5.2 Provider Reuse & Decoupling Audit
- **`AIProvider` Abstract Base (`services/ai/aiProvider.js`)**: Extend interface with:
  - `reviewCode(input): Promise<ReviewOutput>`
  - `generateHint(input): Promise<HintOutput>`
  - `generateRecommendations(input): Promise<RecommendationOutput>`
- **`GeminiProvider` (`services/ai/geminiProvider.js`)**: Reuses `@google/genai` with strict structured `Type.OBJECT` JSON schemas for both hints and recommendations.
- **`MockAiProvider` (`services/ai/mockAiProvider.js`)**: Reuses deterministic test provider with configurable modes (`success`, `error`, `malformed`, `unavailable`).

---

## 6. PART 5 — System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Client Layer (React / Vite)                           │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────────┐  │
│  │ ProblemWorkspace.jsx  │  │       Room.jsx        │  │    Dashboard.jsx    │  │
│  │  [💡 Get Hint Button] │  │ [💡 Get Hint Button]  │  │ [🎯 Recommendations]│  │
│  └───────────┬───────────┘  └───────────┬───────────┘  └──────────┬──────────┘  │
└──────────────┼──────────────────────────┼─────────────────────────┼─────────────┘
               │ POST /api/submissions/hint                         │ GET /api/users/recommendations
               ▼                                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            CodeSync Express API Layer                           │
│  ┌────────────────────────────────────────┐  ┌───────────────────────────────┐  │
│  │ submissionRoutes.js                    │  │ userRoutes.js                 │  │
│  │ • protect                              │  │ • protect                     │  │
│  │ • aiHintLimiter (6/min)                │  │ • recommendationLimiter       │  │
│  │ • Room membership & status checks      │  │                               │  │
│  └───────────────────┬────────────────────┘  └───────────────┬───────────────┘  │
└──────────────────────┼───────────────────────────────────────┼──────────────────┘
                       ▼                                       ▼
┌──────────────────────────────────────────┐  ┌───────────────────────────────────┐
│            aiHintService.js              │  │     recommendationService.js      │
│ • Validates code & problem context       │  │ • Queries solvedProblems & topics │
│ • Strips hidden test fixtures            │  │ • Deterministic candidate query   │
│ • Validates structured output schema     │  │ • Optional AI rationale decorator │
└──────────────────────┬───────────────────┘  └────────────────┬──────────────────┘
                       │                                       │
                       └───────────────────┬───────────────────┘
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          AI Provider Factory & SDK                              │
│  ┌───────────────────────────────────────────────────────────────────────────┐  │
│  │ AIProvider Interface (reviewCode, generateHint, generateRecommendations) │  │
│  └─────────────────────────────────────┬─────────────────────────────────────┘  │
│                                        │                                        │
│                 ┌──────────────────────┴──────────────────────┐                 │
│                 ▼                                             ▼                 │
│  ┌─────────────────────────────┐               ┌─────────────────────────────┐  │
│  │     GeminiProvider.js       │               │      MockAiProvider.js      │  │
│  │  (Official @google/genai)   │               │   (Deterministic Offline)   │  │
│  └──────────────┬──────────────┘               └─────────────────────────────┘  │
└─────────────────┼───────────────────────────────────────────────────────────────┘
                  ▼ HTTPS
    ┌───────────────────────────┐
    │     Google Gemini API     │
    └───────────────────────────┘
```

---

## 7. PART 6 — API Contract

### 7.1 `POST /api/submissions/hint`

- **Description:** Requests an advisory, Socratic technical hint for the current problem and code.
- **Auth:** Required (`protect` middleware).
- **Rate Limit:** 6 requests / minute / user.
- **Room Lifecycle Rule:** If `roomId` is present, validates membership. If room status is `CLOSED`, returns `400 ROOM_CLOSED`.

#### Error Status Codes:
- `400 Bad Request` (`AI_INVALID_INPUT` / `ROOM_CLOSED`): Invalid parameters or closed room.
- `401 Unauthorized` (`UNAUTHORIZED`): User is not logged in.
- `403 Forbidden` (`FORBIDDEN`): User is not a member of the specified room.
- `404 Not Found` (`PROBLEM_NOT_FOUND` / `ROOM_NOT_FOUND`): Problem or room ID does not exist.
- `429 Too Many Requests` (`AI_RATE_LIMIT`): Hint rate limit exceeded.
- `502 Bad Gateway` (`AI_PROVIDER_ERROR` / `AI_MALFORMED_RESPONSE`): Gemini failure or schema parse error.
- `503 Service Unavailable` (`AI_SERVICE_UNAVAILABLE`): Missing API key or provider downtime.
- `504 Gateway Timeout` (`AI_TIMEOUT`): Request exceeded 15 seconds.

---

### 7.2 `GET /api/users/recommendations`

- **Description:** Returns 3 personalized coding recommendations based on solved history, difficulty spread, and topic coverage.
- **Auth:** Required (`protect` middleware).
- **Rate Limit:** 10 requests / minute / user.

#### Error Status Codes:
- `401 Unauthorized` (`UNAUTHORIZED`): Authentication cookie missing or invalid.
- `404 Not Found` (`USER_NOT_FOUND`): User account does not exist.
- `429 Too Many Requests` (`RATE_LIMIT_EXCEEDED`): Exceeded rate limit.
- `500 Internal Server Error` (`SERVER_ERROR`): Database aggregation error.

---

## 8. PART 7 — Frontend Integration Contract

### 8.1 Problem Workspace (`ProblemWorkspace.jsx`) & Room (`Room.jsx`)
- **Location:** Added alongside the Run / Submit / AI Review controls in the editor toolbar.
- **Hint Trigger:** "💡 Get Hint" button.
- **UI Presentation:** Displays in the left tabbed drawer or as a dedicated collapsible Hint banner/card inside the Problem tab:
  - Tab list in `Room.jsx` / `ProblemWorkspace.jsx`: `[Problem] | [Submissions] | [AI Review] | [💡 Hint]` (or integrated modal/panel).
- **Cooldown & State Management:**
  - Independent `hintCooldown` state (e.g., 10s client countdown).
  - Independent `isHintLoading` spinner.
  - Independent `hintError` alert.
  - Stale response prevention via `hintTokenRef`.
- **CLOSED-Room Behavior:** In a CLOSED room, the "Get Hint" button is disabled with tooltip *"This room has ended. Code execution and AI assistance are closed."*

### 8.2 Dashboard (`Dashboard.jsx`)
- **Location:** Dedicated **"🎯 Recommended Challenges"** card section above or alongside the Problems Explorer table.
- **Interactivity:**
  - Displays top 3 cards with problem title, difficulty badge, topic tags, and the 1-sentence pedagogical rationale.
  - Clicking a card navigates directly to `/problems/:slug`.
  - Includes a quick "Refresh Recommendations" button with loading spinner.

---

## 9. PART 8 — Verification Plan

### 9.1 Automated Backend Unit & Service Tests (`backend/tests/`)
1. **`aiHintService.test.js`**:
   - Validates input validation (code length limit, allowed languages, valid ObjectId).
   - Validates sanitization: strips hidden tests, email, passwords.
   - Validates output schema parsing: ensures `concept`, `observation`, `suggestedStep`, `pitfallToAvoid` exist.
   - Validates malformed AI response handling ($502$).
   - Validates mock provider offline behavior.
2. **`recommendationService.test.js`**:
   - Validates zero-solved new user flow (returns Easy starter problems).
   - Validates exclusion of already-solved problems.
   - Validates topic weakness detection.
   - Validates fallback behavior when Gemini is disabled/fails.
3. **`submissionRoutes.test.js` (`POST /api/submissions/hint`)**:
   - Tests authentication guard ($401$).
   - Tests room authorization ($403$ for non-members).
   - Tests closed room rejection ($400\text{ ROOM\_CLOSED}$).
   - Tests rate limiting ($429$ on 7th rapid call).
4. **`userRoutes.test.js` (`GET /api/users/recommendations`)**:
   - Tests response envelope and schema format.
   - Tests unauthenticated access rejection ($401$).

### 9.2 Frontend Verification
- Verify "Get Hint" button loading spinner, cooldown timer, and error banner in `ProblemWorkspace.jsx`.
- Verify Hint rendering in `Room.jsx` with socket updates and CLOSED room disabled state.
- Verify Recommendation cards in `Dashboard.jsx` and direct slug navigation.

---

## 10. PART 9 — Scope Control & Out-of-Scope Boundaries

The following are **STRICTLY OUT OF SCOPE** for Stage 10:
- **No Operational Transformation (OT) / CRDT changes** in Room editor.
- **No Refactoring of core Room.jsx socket lifecycle or execution logic**.
- **No Automatic Background AI execution** (keystroke-triggered hints, automated background callers).
- **No New MongoDB Collections** (recommendations are computed on-demand from existing models).
- **No Autonomous Code Modification** (hints and recommendations are purely advisory and never overwrite the user's code editor without explicit action).
- **No Full Solution Generation** in Hints (hints must remain Socratic and directional).

---

## 11. PART 10 — Final Verdict & Recommended Sequence

### **VERDICT: APPROVED**

The current architecture, MongoDB models, analytics service, and AI provider infrastructure cleanly and securely support Stage 10 without requiring database schema migrations or core socket/room refactoring.

### Recommended Stage 10 Implementation Sequence:
1. **Stage 10.1 — AI Hint Foundation & Service:**
   - Extend `AIProvider` interface with `generateHint(input)`.
   - Implement `aiHintService.js` with strict input sanitization and output schema validation.
2. **Stage 10.2 — Gemini Hint Provider Integration:**
   - Add hint prompt builder, system instruction, and `Type.OBJECT` schema in `GeminiProvider.js`.
   - Update `MockAiProvider.js` with deterministic hint mock responses.
3. **Stage 10.3 — AI Hint API Route:**
   - Mount `POST /api/submissions/hint` with `protect`, `aiHintLimiter`, and room authorization.
4. **Stage 10.4 — Recommendation Engine & Service:**
   - Implement `recommendationService.js` (deterministic candidate filter + AI pedagogical decorator + fallback).
   - Mount `GET /api/users/recommendations` in `userRoutes.js`.
5. **Stage 10.5 — Frontend AI Hint UI:**
   - Integrate "💡 Get Hint" tab/panel in `ProblemWorkspace.jsx` and `Room.jsx` with cooldown and CLOSED-room guards.
6. **Stage 10.6 — Frontend Recommendations UI:**
   - Integrate "🎯 Recommended Challenges" card widget in `Dashboard.jsx`.
7. **Stage 10.7 — End-to-End Verification & Test Suite:**
   - Execute backend test suite (`npm test`) and live browser verification with Chrome DevTools.
