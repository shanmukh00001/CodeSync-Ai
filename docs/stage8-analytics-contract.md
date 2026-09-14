# CodeSync AI — Stage 8.1: Personal Analytics API Contract

> **Document Type:** Architecture & API Specification Contract  
> **Target Route:** `GET /api/users/analytics`  
> **Status:** Final Contract (Stage 8.1) — **Specification Only / No Implementation in This Pass**  
> **Authoritative Sources:** Existing MongoDB collections (`users`, `submissions`, `problems`)

---

## 1. Executive Summary & Design Principles

### 1.1 Purpose
This contract establishes the formal, deterministic specification for the future `GET /api/users/analytics` endpoint. The endpoint derives high-fidelity personal developer analytics from existing persisted MongoDB data (`User.solvedProblems`, `Submission`, and `Problem` records) without requiring an independent `Analytics` collection or duplicating solved-problem state.

### 1.2 Core Architectural Principles
1. **Single Authoritative Source per Metric:**
   - **Solved Problems & Difficulty Distribution:** Sourced strictly from `User.solvedProblems` (populated with `problem` references) and unique resolved `Problem.difficulty` / `Problem.tags`. Solved status is **never** inferred from raw `Submission` history.
   - **Submission Statuses, Activity, & Performance:** Sourced strictly from persisted `Submission` documents matching `{ user: req.userId }`.
2. **Inclusive Submission Scope:**
   - Overall submission statistics include **both** solo submissions (`room === null`) and collaborative room submissions (`room !== null`).
   - Run executions (test runs) are ephemeral and **not** persisted as `Submission` documents; therefore, Run requests do not count toward analytics or activity streaks.
3. **Strict Privacy & Aggregation Guarantee:**
   - The analytics endpoint **never** returns raw source code, test inputs, expected/actual outputs, hidden test data, `failedTestCase` objects, room messages, or JWT/session artifacts.
   - Only mathematical and statistical aggregates are exposed.
4. **Deterministic Zero/Null Handling:**
   - Empty or newly registered users with zero submissions and zero solved problems receive a fully structured JSON response with normalized zero counts and `null` performance indicators rather than HTTP errors (e.g., 404/500).

---

## 2. Authentication & Authorization

| Attribute | Specification |
| :--- | :--- |
| **HTTP Method** | `GET` |
| **Path** | `/api/users/analytics` |
| **Protection** | Protected route via `authMiddleware` (Cookie-based JWT session / `token`) |
| **Identity Sourcing** | **Exclusively** `req.userId` extracted from validated JWT payload |
| **Forbidden Inputs** | `userId`, `user`, or `id` in query parameters, request body, or headers are **strictly ignored/rejected** |
| **Failure Statuses** | `401 Unauthorized` if token is missing, expired, or invalid |

---

## 3. Metric Calculations & Derivation Rules

### 3.1 Solved Problems Breakdown (`solved`)

* **Authoritative Source:** `User.solvedProblems` array.
* **Calculation Rules:**
  - `totalSolved`: Length of unique solved problem references in `User.solvedProblems`.
  - `easySolved`: Count of unique problems in `User.solvedProblems` where `Problem.difficulty === "Easy"`.
  - `mediumSolved`: Count of unique problems in `User.solvedProblems` where `Problem.difficulty === "Medium"`.
  - `hardSolved`: Count of unique problems in `User.solvedProblems` where `Problem.difficulty === "Hard"`.
* **Zero Handling:** All counts default to `0` if array is empty.

### 3.2 Submission Status Counts (`submissions`)

* **Authoritative Source:** `Submission.find({ user: req.userId })`.
* **Calculation Rules:**
  - `total`: Total count of persisted submissions.
  - `accepted`: Count where `status === "Accepted"`.
  - `wrongAnswer`: Count where `status === "Wrong Answer"`.
  - `timeLimitExceeded`: Count where `status === "Time Limit Exceeded"`.
  - `runtimeError`: Count where `status === "Runtime Error"`.
  - `compilationError`: Count where `status === "Compilation Error"`.
  - `soloSubmissions`: Count where `room === null`.
  - `roomSubmissions`: Count where `room !== null`.

### 3.3 Acceptance Rate (`acceptanceRate`)

* **Formula:**
  $$\text{acceptanceRate} = \left( \frac{\text{accepted submissions}}{\text{total persisted submissions}} \right) \times 100$$
* **Rounding Rule:** Rounded to 1 decimal place (e.g., `66.7`).
* **Zero/Empty State:** If `total === 0`, `acceptanceRate = 0.0`.

### 3.4 Activity & Streaks (`activity`)

* **Timezone Reference:** All daily aggregation and calendar boundaries use **UTC**.
* **Active Day Definition:** A UTC calendar day (`YYYY-MM-DD`) is active if and only if the user has **at least 1** persisted `Submission` (`createdAt` falling within that UTC day). Includes both solo and room submissions.
* **`activityByDay`:**
  - Returns array of objects `{ date: "YYYY-MM-DD", submissions: number }`.
  - Returns **active days only** (omits zero-submission days).
  - Ordered **chronologically ascending** by date.
* **`currentStreak`:**
  - Number of consecutive UTC calendar days up to today (or yesterday if no submission has been made yet today) with at least 1 persisted submission.
  - If neither today nor yesterday has a submission, `currentStreak = 0`.
* **`longestStreak`:**
  - The maximum consecutive sequence of active UTC days across the user's entire history.
  - If no submissions exist, `longestStreak = 0`.

### 3.5 Performance Benchmarks (`performance`)

* **Authoritative Source:** `Submission` documents for `req.userId`.
* **Valid Measurement Filter:**
  - Runtime measurements are valid if `typeof runtimeMs === "number"` and `runtimeMs > 0` (or `status === "Accepted"` with recorded non-negative integer).
  - Memory measurements are valid if `typeof memoryKb === "number"` and `memoryKb > 0`.
* **Calculations:**
  - `averageRuntimeMs`: Arithmetic mean of `runtimeMs` across all submissions with valid runtime, rounded to 1 decimal place. If no valid measurements, returns `null`.
  - `fastestAcceptedRuntimeMs`: Minimum `runtimeMs` among submissions where `status === "Accepted"` and `runtimeMs > 0`. If none, returns `null`.
  - `averageMemoryKb`: Arithmetic mean of `memoryKb` across all submissions with valid memory, rounded to 1 decimal place. If no valid measurements, returns `null`.

### 3.6 Topic / Tag Distribution (`topics`)

* **Authoritative Source:** `Problem.tags` resolved from the unique problems in `User.solvedProblems`.
* **Calculation Rules:**
  - For each unique solved problem, iterate through its `tags` array.
  - Count occurrences of each tag (each solved problem contributes at most 1 to a given tag count).
  - Return as an array of objects: `{ tag: string, solvedCount: number }`, sorted descending by `solvedCount`, then alphabetically by `tag`.
  - If no solved problems exist, returns `[]`.

---

## 4. Response Contract

### 4.1 Response Field Definitions

| Field Path | Type | Nullable | Description & Calculation Rule |
| :--- | :--- | :--- | :--- |
| `success` | `Boolean` | No | Always `true` for `200 OK`. |
| `analytics.userId` | `String` | No | Hex string of `req.userId`. |
| `analytics.generatedAt` | `String` | No | ISO 8601 UTC timestamp of calculation. |
| `analytics.solved.totalSolved` | `Number` | No | Total unique solved problems count. |
| `analytics.solved.easy` | `Number` | No | Unique solved problems with "Easy" difficulty. |
| `analytics.solved.medium` | `Number` | No | Unique solved problems with "Medium" difficulty. |
| `analytics.solved.hard` | `Number` | No | Unique solved problems with "Hard" difficulty. |
| `analytics.submissions.total` | `Number` | No | Total persisted submissions (solo + room). |
| `analytics.submissions.accepted` | `Number` | No | Total submissions with status `Accepted`. |
| `analytics.submissions.wrongAnswer` | `Number` | No | Total submissions with status `Wrong Answer`. |
| `analytics.submissions.timeLimitExceeded` | `Number` | No | Total submissions with status `Time Limit Exceeded`. |
| `analytics.submissions.runtimeError` | `Number` | No | Total submissions with status `Runtime Error`. |
| `analytics.submissions.compilationError` | `Number` | No | Total submissions with status `Compilation Error`. |
| `analytics.submissions.soloSubmissions` | `Number` | No | Submissions where `room === null`. |
| `analytics.submissions.roomSubmissions` | `Number` | No | Submissions where `room !== null`. |
| `analytics.submissions.acceptanceRate` | `Number` | No | `(accepted / total) * 100`, rounded to 1 decimal; `0` if `total === 0`. |
| `analytics.activity.currentStreak` | `Number` | No | Consecutive active UTC days ending today or yesterday. |
| `analytics.activity.longestStreak` | `Number` | No | Highest historical consecutive active UTC days. |
| `analytics.activity.activityByDay` | `Array<Object>` | No | Chronological active days `[{ date: "YYYY-MM-DD", submissions: N }]`. |
| `analytics.performance.averageRuntimeMs` | `Number` | **Yes** | Mean runtime in ms for valid records; `null` if no valid records. |
| `analytics.performance.fastestAcceptedRuntimeMs` | `Number` | **Yes** | Lowest runtime in ms for Accepted submissions; `null` if none. |
| `analytics.performance.averageMemoryKb` | `Number` | **Yes** | Mean memory in KB for valid records; `null` if no valid records. |
| `analytics.topics` | `Array<Object>` | No | Topic frequency from solved problems `[{ tag: string, solvedCount: number }]`. |

---

### 4.2 Standard Example Response (Active User)

```json
{
  "success": true,
  "analytics": {
    "userId": "6640c2e91234567890abcdef",
    "generatedAt": "2026-09-14T10:45:00.000Z",
    "solved": {
      "totalSolved": 14,
      "easy": 8,
      "medium": 5,
      "hard": 1
    },
    "submissions": {
      "total": 28,
      "accepted": 18,
      "wrongAnswer": 6,
      "timeLimitExceeded": 2,
      "runtimeError": 1,
      "compilationError": 1,
      "soloSubmissions": 18,
      "roomSubmissions": 10,
      "acceptanceRate": 64.3
    },
    "activity": {
      "currentStreak": 3,
      "longestStreak": 5,
      "activityByDay": [
        { "date": "2026-09-10", "submissions": 4 },
        { "date": "2026-09-11", "submissions": 6 },
        { "date": "2026-09-12", "submissions": 8 },
        { "date": "2026-09-13", "submissions": 5 },
        { "date": "2026-09-14", "submissions": 5 }
      ]
    },
    "performance": {
      "averageRuntimeMs": 42.6,
      "fastestAcceptedRuntimeMs": 12,
      "averageMemoryKb": 14280.5
    },
    "topics": [
      { "tag": "Array", "solvedCount": 10 },
      { "tag": "Hash Table", "solvedCount": 8 },
      { "tag": "Two Pointers", "solvedCount": 5 },
      { "tag": "Dynamic Programming", "solvedCount": 3 },
      { "tag": "String", "solvedCount": 2 },
      { "tag": "Binary Search", "solvedCount": 1 }
    ]
  }
}
```

---

### 4.3 Zero-Data Response (New / Inactive User)

```json
{
  "success": true,
  "analytics": {
    "userId": "6640c2e91234567890fedcba",
    "generatedAt": "2026-09-14T10:45:00.000Z",
    "solved": {
      "totalSolved": 0,
      "easy": 0,
      "medium": 0,
      "hard": 0
    },
    "submissions": {
      "total": 0,
      "accepted": 0,
      "wrongAnswer": 0,
      "timeLimitExceeded": 0,
      "runtimeError": 0,
      "compilationError": 0,
      "soloSubmissions": 0,
      "roomSubmissions": 0,
      "acceptanceRate": 0.0
    },
    "activity": {
      "currentStreak": 0,
      "longestStreak": 0,
      "activityByDay": []
    },
    "performance": {
      "averageRuntimeMs": null,
      "fastestAcceptedRuntimeMs": null,
      "averageMemoryKb": null
    },
    "topics": []
  }
}
```

---

## 5. Database Architecture & Indexing Recommendations

### 5.1 No Separate Analytics Collection
No dedicated `Analytics` collection is required. Persisting precomputed analytics collections introduces cache-invalidation race conditions and state duplication. All metrics can be aggregated on demand via MongoDB aggregation pipelines or targeted queries on `users` and `submissions`.

### 5.2 Recommended Compound Indexes for Submissions
*(To be created in future implementation phases, not during Stage 8.1)*

1. **`{ user: 1, createdAt: -1 }`**
   - **Rationale:** Accelerates user-scoped chronological aggregation for `activityByDay`, streak computations, and recent activity filtering.
2. **`{ user: 1, status: 1 }`**
   - **Rationale:** Supports rapid filtering for `status === "Accepted"` (for performance calculations and status counts) without scanning the entire collection.
3. **`{ user: 1, problem: 1, createdAt: -1 }`**
   - **Rationale:** Optimizes user problem-submission correlation queries and prevents index bloat across multi-tenant submission workloads.

---

## 6. Privacy & Security Constraints

To guarantee developer privacy and prevent accidental leakage of proprietary problem tests or user code:
* **Excluded Attributes:** `code`, `failedTestCase`, `testResults`, `input`, `expectedOutput`, `actualOutput`, `errorMessage`.
* **Room Privacy:** Does not expose room participant lists or chat/discussion messages.
* **Token Safety:** Does not expose session tokens or password hashes.

---

## 7. Stage 8.1 Verification & Compliance Checklist

- [x] Contract created at `docs/stage8-analytics-contract.md`.
- [x] Authoritative sources matched against `User`, `Submission`, and `Problem` Mongoose models.
- [x] Authentication strictly requires `req.userId` from cookie JWT.
- [x] Run requests explicitly excluded from persistence & streak counts.
- [x] Solved status explicitly tied to `User.solvedProblems`.
- [x] Performance metrics return `null` (not `0`) when measurements are missing.
- [x] UTC timezone specified for streaks and active days.
- [x] Complete active user and zero-data user response JSON contracts provided.
- [x] Recommended indexes documented with technical rationales without modifying schemas.
- [x] **No backend/frontend code, models, or APIs modified during this pass.**
