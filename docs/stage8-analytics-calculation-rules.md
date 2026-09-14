# CodeSync AI — Stage 8.2: Personal Analytics Calculation Rules & Implementation Algorithms

> **Document Type:** Deterministic Calculation Specification  
> **Reference Contract:** `docs/stage8-analytics-contract.md` (Stage 8.1 APPROVED)  
> **Status:** Final Calculation Specification (Stage 8.2) — **Specification Only / No Implementation in This Pass**  
> **Target Endpoint:** `GET /api/users/analytics` (Protected via `req.userId`)

---

## 1. Executive Summary & Implementation Boundary

This document defines the exact, deterministic mathematical algorithms, filtering rules, edge-case handling, and database query strategy for calculating every metric required by the Stage 8.1 Personal Analytics API Contract.

### Implementation Staging Roadmap
- **Stage 8.1:** Analytics API Contract *(Approved)*
- **Stage 8.2 (Current):** Deterministic Calculation Rules & Edge-Case Algorithms *(Design & Documentation Only)*
- **Stage 8.3:** Analytics Service Implementation (`backend/services/analyticsService.js`)
- **Stage 8.4:** Controller & Route Integration (`GET /api/users/analytics`)
- **Stage 8.5:** Backend Integration & Automated Verification Testing

---

## 2. Solved Problems & Topics Calculation Rules

### 2.1 Data Retrieval & Model Population
- Query the `User` document by `_id = req.userId`, selecting `solvedProblems`.
- Populate `solvedProblems.problem` with fields: `title`, `difficulty`, `tags`.

### 2.2 Deduplication & Referential Integrity
1. **Uniqueness Filter:**
   - Maintain a `Set<string>` of seen problem IDs (`problemIdStr = String(p._id)`).
   - If `User.solvedProblems` contains duplicate problem references, only the first occurrence is processed. Duplicate references contribute at most **once** to `totalSolved`, difficulty counts, and topic tags.
2. **Orphan / Deleted Problem Handling:**
   - If `solvedItem.problem` is `null` / `undefined` (e.g., the referenced `Problem` was deleted from MongoDB or unpopulated), it is **silently ignored** and does not increment `totalSolved` or any difficulty/tag count.

### 2.3 Difficulty Categorization
For each unique valid `Problem` document:
- If `problem.difficulty === "Easy"`, increment `solved.easy` by 1.
- If `problem.difficulty === "Medium"`, increment `solved.medium` by 1.
- If `problem.difficulty === "Hard"`, increment `solved.hard` by 1.
- If `problem.difficulty` is missing or unrecognized, it increments `totalSolved` but does not increment easy/medium/hard counters.

$$\text{solved.totalSolved} = \text{count of unique, non-null resolved problems}$$

### 2.4 Topics / Tag Aggregation Algorithm
1. Initialize an in-memory map: `tagMap = new Map<string, number>()`.
2. For each unique valid `Problem`:
   - Obtain `problem.tags` (default to empty array `[]` if missing/null).
   - Deduplicate tags within the individual problem: `problemTags = new Set(problem.tags.filter(t => typeof t === "string" && t.trim() !== ""))`.
   - For each normalized tag `tag` in `problemTags`:
     - Trim whitespace: `cleanTag = tag.trim()`.
     - Update map: `tagMap.set(cleanTag, (tagMap.get(cleanTag) || 0) + 1)`.
3. Transform `tagMap` into an array of objects: `[{ tag, solvedCount }]`.
4. **Deterministic Sorting:**
   1. Primary: `solvedCount` descending (`b.solvedCount - a.solvedCount`).
   2. Secondary: Alphabetical ascending by `tag` (`a.tag.localeCompare(b.tag)`).
5. If zero solved problems exist, return `[]`.

---

## 3. Submission Status & Acceptance Rate Rules

### 3.1 Submission Filtering & Status Mapping
Query all `Submission` documents where `user = req.userId`.

The `Submission.status` field matches the Mongoose schema enum:
- `"Accepted"`
- `"Wrong Answer"`
- `"Time Limit Exceeded"`
- `"Runtime Error"`
- `"Compilation Error"`
- `"Pending"` *(legacy or in-flight)*

#### Exact Counter Mapping:
- `submissions.total`: Total count of persisted submissions for the user.
- `submissions.accepted`: Count where `status === "Accepted"`.
- `submissions.wrongAnswer`: Count where `status === "Wrong Answer"`.
- `submissions.timeLimitExceeded`: Count where `status === "Time Limit Exceeded"`.
- `submissions.runtimeError`: Count where `status === "Runtime Error"`.
- `submissions.compilationError`: Count where `status === "Compilation Error"`.
- `submissions.soloSubmissions`: Count where `room === null` or `room === undefined`.
- `submissions.roomSubmissions`: Count where `room !== null` and `room !== undefined`.

*Note:* If an unexpected status string exists (e.g. `"Pending"` or custom legacy status), it is counted in `submissions.total` and in solo/room breakdowns, but does not increment any of the 5 explicit failure/success counters.

### 3.2 Acceptance Rate Computation
- **Formula:**
  $$\text{acceptanceRate} = \begin{cases} 0.0 & \text{if } \text{submissions.total} = 0 \\ \text{Math.round}\left(\frac{\text{submissions.accepted}}{\text{submissions.total}} \times 1000\right) / 10 & \text{if } \text{submissions.total} > 0 \end{cases}$$
- **Type:** Always numeric (`typeof acceptanceRate === "number"`).
- **Precision:** Rounded to exactly 1 decimal place (e.g. `66.666...` $\rightarrow$ `66.7`, `100` $\rightarrow$ `100.0` or `100`).

---

## 4. Activity & Streak Calculation Algorithm

### 4.1 UTC Date Normalization
- All calendar day boundaries use **Coordinated Universal Time (UTC)**.
- Extract `createdAt` from each `Submission` document.
- Format to standard UTC calendar key: `YYYY-MM-DD` via `new Date(sub.createdAt).toISOString().slice(0, 10)` or `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()`.
- Ignore future-dated submissions if `createdAt > new Date()` (or treat them as current UTC day).

### 4.2 `activityByDay` Construction
1. Group submissions by UTC date string using `Map<string, number>()`.
2. Multiple submissions on the same day increment that day's submission counter.
3. Transform map to an array of objects: `{ date: string, submissions: number }`.
4. Filter: Include **only active days** (days where `submissions >= 1`).
5. Sort chronologically ascending: `activityByDay.sort((a, b) => a.date.localeCompare(b.date))`.

### 4.3 `currentStreak` & `longestStreak` Algorithm

Let `activeDateSet` be a `Set<string>` containing all unique active UTC dates formatted as `YYYY-MM-DD`.

#### UTC Day Anchor Dates:
- Let $D_{\text{today}}$ be the current UTC date string (`new Date().toISOString().slice(0, 10)`).
- Let $D_{\text{yesterday}}$ be the previous UTC calendar date string.

#### Calculation Steps:

1. **Current Streak Determination:**
   - If `activeDateSet` is empty $\rightarrow$ `currentStreak = 0`.
   - Check if the user was active today ($D_{\text{today}} \in \text{activeDateSet}$) or active yesterday ($D_{\text{yesterday}} \in \text{activeDateSet}$):
     - If neither today nor yesterday is in `activeDateSet` $\rightarrow$ `currentStreak = 0`.
     - If today is in `activeDateSet`, set anchor $D = D_{\text{today}}$.
     - If today is NOT in `activeDateSet` but yesterday IS, set anchor $D = D_{\text{yesterday}}$.
   - Initialize `currentStreak = 0`.
   - While $D \in \text{activeDateSet}$:
     - `currentStreak += 1`
     - Step $D$ backward by exactly 1 UTC calendar day.

2. **Longest Streak Determination:**
   - If `activeDateSet` is empty $\rightarrow$ `longestStreak = 0`.
   - Sort all unique active dates chronologically: $D_0, D_1, \dots, D_{n-1}$.
   - Initialize `longestStreak = 1`, `tempStreak = 1`.
   - For $i$ from 1 to $n - 1$:
     - Let $\Delta$ be the difference in days between $D_i$ and $D_{i-1}$:
       $$\Delta = \frac{\text{Date}(D_i) - \text{Date}(D_{i-1})}{86,400,000 \text{ ms}}$$
     - If $\Delta = 1$ (exact consecutive calendar day):
       - `tempStreak += 1`
       - `longestStreak = Math.max(longestStreak, tempStreak)`
     - Else if $\Delta > 1$ (gap of 1 or more days):
       - `tempStreak = 1`
   - Return `longestStreak`.

#### Example Scenarios:

| Active Days Set | Today Date | `currentStreak` | `longestStreak` | Rationale |
| :--- | :--- | :--- | :--- | :--- |
| `[]` | `2026-09-14` | `0` | `0` | No activity recorded. |
| `['2026-09-14']` | `2026-09-14` | `1` | `1` | Single activity today. |
| `['2026-09-13']` | `2026-09-14` | `1` | `1` | Active yesterday; today is still open. |
| `['2026-09-12']` | `2026-09-14` | `0` | `1` | Inactive today & yesterday; streak broken. |
| `['2026-09-10', '2026-09-11', '2026-09-13', '2026-09-14']` | `2026-09-14` | `2` | `2` | Consecutive pair (13, 14), broken by gap on 12. |
| `['2026-09-01' ... '2026-09-05', '2026-09-14']` | `2026-09-14` | `1` | `5` | Historical 5-day streak; current streak is 1. |

---

## 5. Performance Metrics & Measurement Validity Rules

### 5.1 Measurement Validity Definition
To ensure statistical integrity and prevent skewed averages from missing or corrupted records:

A **runtime measurement** `runtimeMs` is **valid** if and only if:
```javascript
typeof runtimeMs === "number" && Number.isFinite(runtimeMs) && runtimeMs >= 0
```
- Invalid values: `null`, `undefined`, `NaN`, `Infinity`, `-Infinity`, negative numbers, strings, or missing properties.

A **memory measurement** `memoryKb` is **valid** if and only if:
```javascript
typeof memoryKb === "number" && Number.isFinite(memoryKb) && memoryKb > 0
```
- Invalid values: `null`, `undefined`, `NaN`, `Infinity`, `<= 0`, strings, or missing properties.

### 5.2 Performance Metric Formulas

1. **`averageRuntimeMs`:**
   - Filter user submissions to those with valid `runtimeMs`.
   - If valid count $= 0 \rightarrow$ return `null`.
   - Otherwise:
     $$\text{averageRuntimeMs} = \text{Math.round}\left(\frac{\sum \text{valid } runtimeMs}{\text{count}} \times 10\right) / 10$$

2. **`fastestAcceptedRuntimeMs`:**
   - Filter user submissions to those where `status === "Accepted"` and `runtimeMs` is valid and `runtimeMs > 0`.
   - If matching count $= 0 \rightarrow$ return `null`.
   - Otherwise:
     $$\text{fastestAcceptedRuntimeMs} = \min(\text{matching } runtimeMs)$$

3. **`averageMemoryKb`:**
   - Filter user submissions to those with valid `memoryKb`.
   - If valid count $= 0 \rightarrow$ return `null`.
   - Otherwise:
     $$\text{averageMemoryKb} = \text{Math.round}\left(\frac{\sum \text{valid } memoryKb}{\text{count}} \times 10\right) / 10$$

---

## 6. Database Query Strategy Evaluation

### 6.1 Architectural Options

| Strategy | Node.js In-Memory Processing | Pure MongoDB Aggregation | Hybrid Approach (Recommended) |
| :--- | :--- | :--- | :--- |
| **Description** | Fetch all raw `User` and `Submission` records into Node and compute everything via JS loops. | Run complex multistage aggregation pipelines (`$facet`, `$group`, `$bucket`, `$setWindowFields`) in MongoDB. | 1 lean query on `User` with populated solved problems + 1 projection-filtered query on `Submission` (`{ user: req.userId }`). In-memory JavaScript computes streaks and stats. |
| **Memory / CPU** | High memory if heavy payload (e.g. `code`, `testResults`). | High DB CPU for complex calendar and streak calculations in Mongo operators. | **Optimal:** DB performs fast indexed index scans; Node handles lightweight mathematical arrays. |
| **Data Transfer** | Large if unprojected. | Minimal. | **Minimal:** Uses explicit projection: `.select("status runtimeMs memoryKb room createdAt")`. |
| **Complexity** | Simple. | Very High / Hard to debug streak date gaps. | **Clean, testable, deterministic, and highly maintainable.** |

### 6.2 Recommended Strategy: Lean Projected Query + Fast In-Memory Aggregation
1. **Query 1 (User Solved Problems):**
   ```javascript
   const user = await User.findById(userId)
     .select("solvedProblems")
     .populate("solvedProblems.problem", "title difficulty tags")
     .lean();
   ```
2. **Query 2 (User Submissions Projection):**
   ```javascript
   const submissions = await Submission.find({ user: userId })
     .select("status runtimeMs memoryKb room createdAt")
     .sort({ createdAt: 1 })
     .lean();
   ```
3. **Execution in Node.js:** Compute difficulty breakdown, tag frequencies, submission counters, UTC streak calculations, and performance averages using standard pure functions.

---

## 7. Data Consistency & Resilience Rules

| Potential Anomaly | Engine Behavior | Output Contract Impact |
| :--- | :--- | :--- |
| **Orphan Solved Problem** (`problem` was deleted) | Population yields `null`. Filtered out via `if (!item.problem) return;`. | Not counted in `totalSolved`, difficulty, or tags. |
| **Orphan Submission Problem** | Submission record is analyzed for submission counts/activity. | Analytics still valid; problem details are not needed for submission aggregates. |
| **Null / Zero Runtime** | Handled by validity predicates (`runtimeMs >= 0`). | If no valid runtimes exist, `averageRuntimeMs = null`. |
| **Null / Zero Memory** | Handled by validity predicates (`memoryKb > 0`). | If no valid memory exists, `averageMemoryKb = null`. |
| **Unexpected Status Value** | Counted in `submissions.total` and solo/room counts. | Does not increment specific status counters (`accepted`, `wrongAnswer`, etc.). |
| **Run Requests** | Never saved to `Submission` collection. | Inherently excluded from analytics and streaks. |

---

## 8. Comprehensive Edge-Case Test Matrix

| # | Test Scenario | Input Data Setup | Expected Calculation Outcome |
| :--- | :--- | :--- | :--- |
| **E01** | **Zero Submissions & Solved** | User with `solvedProblems: []`, `submissions: []` | `totalSolved: 0`, `total: 0`, `acceptanceRate: 0.0`, `currentStreak: 0`, `longestStreak: 0`, `activityByDay: []`, `averageRuntimeMs: null`, `topics: []`. |
| **E02** | **Single Accepted Submission** | 1 submission (`Accepted`, `runtimeMs: 25`, `memoryKb: 10240`, today) | `total: 1`, `accepted: 1`, `acceptanceRate: 100.0`, `currentStreak: 1`, `longestStreak: 1`, `fastestAcceptedRuntimeMs: 25`, `averageRuntimeMs: 25.0`. |
| **E03** | **Multiple Submissions Same Day** | 5 submissions on `2026-09-14` (2 Accepted, 3 Wrong Answer) | `activityByDay: [{ date: '2026-09-14', submissions: 5 }]`, `currentStreak: 1`, `longestStreak: 1`, `total: 5`, `accepted: 2`, `acceptanceRate: 40.0`. |
| **E04** | **Consecutive Days Activity** | Submissions on `2026-09-12`, `2026-09-13`, `2026-09-14` (today) | `currentStreak: 3`, `longestStreak: 3`, `activityByDay` has 3 chronological items. |
| **E05** | **Activity Gap** | Submissions on `2026-09-10`, `2026-09-11`, `2026-09-13`, `2026-09-14` | `currentStreak: 2` (13 and 14), `longestStreak: 2` (both 10-11 and 13-14 are length 2). |
| **E06** | **Active Yesterday Only** | Submissions on `2026-09-13` (yesterday), none today (`2026-09-14`) | `currentStreak: 1`, `longestStreak: 1` (streak maintained because today is ongoing). |
| **E07** | **Active Today Only** | Submissions on `2026-09-14` (today), none yesterday (`2026-09-13`) | `currentStreak: 1`, `longestStreak: 1`. |
| **E08** | **Old Inactive Activity** | Submissions on `2026-08-01`, `2026-08-02`, `2026-08-03` | `currentStreak: 0`, `longestStreak: 3`. |
| **E09** | **Duplicate Solved Problem Reference** | `User.solvedProblems` has `[ProblemA, ProblemA, ProblemB]` | `totalSolved: 2`. Tags and difficulty of ProblemA counted only once. |
| **E10** | **Deleted Problem in Solved List** | `User.solvedProblems` references deleted ID (populates `null`) | Ignored. `totalSolved: 0`. |
| **E11** | **Mixed Solo & Room Submissions** | 3 solo (`room: null`), 2 room (`room: ObjectId(...)`) | `total: 5`, `soloSubmissions: 3`, `roomSubmissions: 2`. Both count toward streaks. |
| **E12** | **Zero Runtime & Null Memory** | Submissions with `runtimeMs: 0`, `memoryKb: null` | `averageRuntimeMs: 0.0`, `averageMemoryKb: null`. |
| **E13** | **Invalid Runtime Values** | Submissions with `runtimeMs: -5`, `NaN`, `undefined` | Filtered out. If all invalid, `averageRuntimeMs: null`. |
| **E14** | **Tags with Whitespace & Duplicates** | Problem with tags `[' Array ', 'Array', 'Hash Table', '', null]` | Normalized to `['Array', 'Hash Table']`. Counted once per problem. |
| **E15** | **Tag Tie-Breaking Sort** | Tags 'Graph' (2), 'Array' (2), 'DP' (1) | Sorted: `[{ tag: 'Array', solvedCount: 2 }, { tag: 'Graph', solvedCount: 2 }, { tag: 'DP', solvedCount: 1 }]`. |

---

## 9. Stage 8.2 Verification Checklist

- [x] Document created at `docs/stage8-analytics-calculation-rules.md`.
- [x] All calculation rules match Stage 8.1 API Contract.
- [x] Runtime validity predicate clearly resolved (`typeof === "number" && Number.isFinite() && >= 0`).
- [x] Memory validity predicate clearly resolved (`typeof === "number" && Number.isFinite() && > 0`).
- [x] UTC streak algorithms defined with day gap handling and yesterday anchor support.
- [x] Orphan and duplicate solved problem handling formally specified.
- [x] Tag deduplication and deterministic sorting defined.
- [x] Recommended query strategy documented with lean projections.
- [x] Comprehensive 15-case edge test matrix included.
- [x] **Zero application code, schemas, or APIs were modified.**
