# CodeSync AI --- Engineering Journey: Piston to the Stage 9 Checkpoint

## Purpose of this document

This document is a detailed engineering history of CodeSync AI from the
point where the project began building a real C++ execution pipeline
with **Piston** through the current **Stage 9 AI Code Review
checkpoint**.

It is intentionally written as a learning/reference document rather than
a short changelog. The goal is to explain:

-   what was built,
-   why it was needed,
-   how the pieces interact,
-   what problems appeared,
-   how those problems were diagnosed,
-   what architectural decisions were made,
-   what was deliberately *not* changed,
-   how the system was verified,
-   and what the current limitations are.

The implementation itself is the source of truth. The architecture plan
acts as the design authority, but implementation findings were allowed
to change details where the real system required it.

------------------------------------------------------------------------

# 1. Starting point: the execution problem

A collaborative coding platform is not complete if it can only display
code.

CodeSync AI needed to be able to:

1.  let a user write C++,
2.  compile that code,
3.  execute it against test cases,
4.  determine whether the result is correct,
5.  distinguish compilation/runtime/timeout failures,
6.  keep hidden tests private,
7.  support both Run and Submit,
8.  and eventually feed safe execution information into AI features.

The first important architectural rule was:

> **Never execute user-submitted code directly inside the Express
> backend process.**

The Node/Express server is responsible for application logic such as:

-   authentication,
-   authorization,
-   room membership,
-   problem selection,
-   persistence,
-   API responses,
-   and orchestration.

It should not become the process that executes arbitrary C++.

That separation is fundamental because user code is untrusted input.

The desired execution flow became:

``` text
React frontend
      |
      | POST /api/submissions/run
      | POST /api/submissions/submit
      v
Express backend
      |
      | validate/authenticate/authorize
      v
Execution service
      |
      | generate safe C++ harness
      v
Piston execution engine
      |
      | compile + run in sandbox
      v
Execution result
      |
      v
Comparator / test runner
      |
      v
Run or Submit result
```

This separation also made it possible to replace Piston later without
redesigning the entire application.

------------------------------------------------------------------------

# 2. Why Piston was chosen

The project needed a real execution engine instead of implementing
process execution itself.

Piston was chosen as the local execution infrastructure.

The important distinction is:

-   **CodeSync owns application-level execution logic.**
-   **Piston owns language execution.**
-   **Docker/Isolate provide infrastructure-level isolation.**

This means CodeSync does not need to directly call `child_process`,
`exec`, `spawn`, or similar APIs to execute arbitrary user programs.

The backend instead sends a prepared execution request to Piston.

That gives the architecture a useful boundary:

``` text
CodeSync
  "Here is the program and the language."

Piston
  "I will compile/run it inside the execution environment."

CodeSync
  "I will interpret the result and decide whether the submission passed."
```

This division is important because correctness checking and execution
are different responsibilities.

------------------------------------------------------------------------

# 3. Setting up the local Piston environment

## 3.1 Windows + Docker + WSL2

The development machine was Windows, so the execution infrastructure was
configured through Docker Desktop using the WSL2 backend.

WSL2 provides the Linux environment required by the Docker-based
execution stack.

The basic infrastructure became:

``` text
Windows
  |
  +-- Docker Desktop
        |
        +-- Linux containers
              |
              +-- Piston API
                    |
                    +-- Isolate sandbox
                          |
                          +-- GCC runtime
```

The project repository for Piston was cloned locally.

The machine was x64/AMD64, which matched the Docker environment being
used.

------------------------------------------------------------------------

## 3.2 The first important operational lesson

A working CodeSync backend does not imply that Piston is running.

There are multiple independent processes:

``` text
MongoDB
Piston
Express backend
Vite frontend
```

If Piston is down, CodeSync can still load normally but execution
requests fail.

A typical startup dependency chain is:

``` text
Docker Desktop / Linux engine
        ↓
Piston :2000
        ↓
CodeSync backend
        ↓
CodeSync frontend
```

A failure such as:

``` text
Failed to connect Piston execution engine
```

was traced to the Docker Linux engine not being available, rather than
being incorrectly diagnosed as a CodeSync code bug.

This distinction matters in real systems:

> **Application failure and infrastructure failure are not the same
> thing.**

------------------------------------------------------------------------

# 4. Piston runtime and GCC

The C++ execution environment needed a compiler/runtime.

GCC 10.2.0 was installed and verified in the Piston environment.

The important idea is that CodeSync does not compile C++ itself.

Instead:

``` text
CodeSync
    ↓
Piston
    ↓
GCC 10.2.0
    ↓
compiled executable
    ↓
sandboxed execution
```

Piston's language configuration determines how C++ is compiled and
executed.

The project also discovered an important Piston behavior involving
filenames.

The Piston C++ runner appends `.cpp` to the supplied source filename.
Therefore, sending a file already named something like:

``` text
main.cpp
```

can produce:

``` text
main.cpp.cpp
```

This looked initially like a possible CodeSync bug, but testing showed
it was Piston's runner behavior.

This was an important debugging lesson:

> Before changing application code, verify the behavior of the external
> dependency.

------------------------------------------------------------------------

# 5. Isolate and sandbox verification

Piston uses Isolate for process-level sandboxing.

The project verified:

-   Isolate was present,
-   Isolate was functioning,
-   cgroup v2 was available,
-   the execution environment was actually sandboxed.

The goal was not simply:

``` text
"Can C++ execute?"
```

but:

``` text
"Can untrusted C++ execute inside the intended isolated environment?"
```

That difference is critical.

The application still treats the execution environment as a security
boundary and does not directly execute arbitrary user code from Express.

------------------------------------------------------------------------

# 6. Piston timeout configuration

Piston was configured with:

``` text
PISTON_COMPILE_TIMEOUT=60000
PISTON_RUN_TIMEOUT=15000
```

The distinction between compile timeout and run timeout matters.

A program can fail because:

1.  compilation takes too long,
2.  execution takes too long,
3.  compilation fails,
4.  execution crashes.

Those should not be collapsed into one generic error.

The backend eventually normalized them into application-level statuses.

------------------------------------------------------------------------

# 7. The execution service abstraction

The backend introduced an execution service instead of scattering Piston
calls throughout routes.

The purpose was architectural isolation.

Conceptually:

``` js
execute(language, source, timeout)
```

rather than:

``` js
// route directly talks to Piston
// route interprets HTTP response
// route parses compiler output
// route decides status
```

The service became responsible for:

-   selecting the supported runtime,
-   making the Piston request,
-   handling HTTP/network errors,
-   parsing Piston responses,
-   mapping Piston results into CodeSync statuses.

C++/C++ language identifiers were mapped to the Piston C++ runtime.

------------------------------------------------------------------------

# 8. Normalized execution statuses

Piston has its own response details. CodeSync needed a stable
application-level contract.

The normalized result became conceptually:

``` js
{
  status:
    "success"
    | "compilation_error"
    | "runtime_error"
    | "time_limit_exceeded"
    | "internal_error",

  stdout,
  stderr,

  compile: {...},
  run: {...},

  error: ...
}
```

This is an example of an **adapter layer**.

The backend does not want every consumer to know Piston's exact response
shape.

Instead:

``` text
Piston-specific response
          ↓
Execution service
          ↓
CodeSync execution contract
```

That is useful because the rest of the application becomes less coupled
to Piston.

------------------------------------------------------------------------

# 9. Error mapping

The mapping was explicitly defined.

### Compilation

If compilation times out:

``` text
time_limit_exceeded
```

If compilation exits unsuccessfully:

``` text
compilation_error
```

### Runtime

If execution times out:

``` text
time_limit_exceeded
```

If execution exits unsuccessfully:

``` text
runtime_error
```

### Successful execution

If both compile and run succeed:

``` text
success
```

### Infrastructure/API problems

Examples:

-   network failure,
-   invalid Piston response,
-   unsupported runtime,
-   malformed response,

map to:

``` text
internal_error
```

This prevents infrastructure problems from being incorrectly presented
as user programming mistakes.

------------------------------------------------------------------------

# 10. Execution-service verification

A dedicated verification script was created for the execution service.

It covered the important mapping behavior.

The execution service verification passed:

``` text
5 / 5
```

The significance was not the number itself.

The important point was that the service contract was tested
independently before being used by higher-level submission logic.

That is a form of **layered verification**.

------------------------------------------------------------------------

# 11. The next problem: CodeSync needed to execute problem functions

Raw C++ execution was not enough.

The platform stores problems with metadata such as:

``` text
functionName
parameters
starterCode
testCases
outputComparator
```

For example, a problem might conceptually require:

``` cpp
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        ...
    }
};
```

The user's submission should implement the expected function rather than
manually writing the entire program.

Therefore CodeSync needed a **C++ harness generator**.

------------------------------------------------------------------------

# 12. The C++ harness

The file:

``` text
backend/services/cppHarnessService.js
```

became responsible for generating a complete executable program around
the user's solution.

Conceptually:

``` text
User solution
     +
problem execution metadata
     +
test case
     ↓
generated C++ program
```

The generated program contains:

1.  required headers,
2.  namespace declarations,
3.  the user's `Solution` code,
4.  a `main()`,
5.  input construction,
6.  function invocation,
7.  result serialization.

The backend then sends that generated program to Piston.

------------------------------------------------------------------------

# 13. Why a harness is necessary

Without a harness, the user would have to submit:

``` cpp
int main() {
    ...
}
```

for every problem.

That makes a problem platform harder to standardize.

With a harness:

``` text
Problem metadata
       ↓
automatic invocation
       ↓
user writes only the intended solution
```

The application controls the execution contract.

This also allows test cases to remain server-controlled.

------------------------------------------------------------------------

# 14. Supported C++ types

The initial harness deliberately supported a bounded set of
parameter/return types.

Examples include:

``` text
int
double
bool
string
vector<int>
vector<string>
vector<vector<string>>
```

The limitation was intentional.

Rather than pretending the harness supported arbitrary C++ reflection,
the implementation created explicit serializers.

For example:

``` text
vector<int>
       ↓
print_result(...)
       ↓
serialized stdout
       ↓
Node comparator
```

This is a practical MVP strategy.

------------------------------------------------------------------------

# 15. Serializer vs comparator

These are different layers.

The C++ serializer answers:

> How do I print the C++ result into text?

The comparator answers:

> Does the printed result represent the expected answer according to
> this problem's rules?

For example:

``` text
C++ result
   ↓
serializer
   ↓
"[1,2]"
   ↓
comparator
   ↓
correct / incorrect
```

Keeping these responsibilities separate made the system easier to reason
about.

------------------------------------------------------------------------

# 16. The `<unordered_map>` bug

During real browser-path testing, a valid Two Sum implementation failed.

The user's solution used:

``` cpp
unordered_map
```

The generated harness initially did not include the appropriate header.

The failure was not in the user's algorithm.

The generated program simply lacked a required C++ standard-library
header.

The harness was fixed to use:

``` cpp
#include <bits/stdc++.h>
using namespace std;
```

This is a very useful debugging example because it demonstrates why
integration testing matters.

A unit test for the harness generator can prove that a string was
generated.

Only a real execution test can prove:

``` text
generated source
    ↓
GCC
    ↓
compiled successfully
    ↓
runs
    ↓
produces correct result
```

After the fix, the real Two Sum path passed:

``` text
3 / 3 visible tests
32 ms
2732 KB
```

------------------------------------------------------------------------

# 17. Harness verification

The harness verification passed:

``` text
6 / 6
```

The test suite validated that the generator produced usable C++
execution programs for the supported problem types.

------------------------------------------------------------------------

# 18. Output comparators

A coding platform cannot always compare raw output byte-for-byte.

CodeSync implemented:

``` text
exact
unordered_array
unordered_nested_array
```

It also defined a floating-point tolerance of:

``` text
1e-6
```

The comparator layer therefore supports problem-specific equality.

For example:

``` text
Expected:
[1, 2]

Actual:
[2, 1]
```

For `exact`:

``` text
FAIL
```

For `unordered_array`:

``` text
PASS
```

This is another example of keeping problem semantics outside the
execution engine.

------------------------------------------------------------------------

# 19. Test-case execution service

The next layer combined:

``` text
harness generation
+
Piston execution
+
output comparison
```

Conceptually:

``` text
test case
   ↓
generate harness
   ↓
execute in Piston
   ↓
if execution error → return execution failure
   ↓
otherwise compare stdout
   ↓
correct / wrong answer
```

The verification passed:

``` text
7 / 7
```

------------------------------------------------------------------------

# 20. The performance problem: too many Piston calls

The first implementation executed tests individually.

For a problem with several tests:

``` text
Test 1 → Piston
Test 2 → Piston
Test 3 → Piston
Test 4 → Piston
...
```

This is conceptually simple but expensive.

Every invocation can involve:

-   request overhead,
-   container/process setup,
-   compilation,
-   sandbox setup,
-   execution,
-   teardown.

The result was extremely slow.

Examples observed:

``` text
Two Sum Run:
~89.8 seconds

Two Sum Submit:
~247.1 seconds
```

Other problems showed similarly high times.

The important realization was:

> The algorithm was not necessarily slow. The execution architecture was
> doing too much work.

------------------------------------------------------------------------

# 21. Unified C++ multi-test execution

The solution was a **unified multi-test harness**.

Instead of:

``` text
N tests → N Piston invocations
```

the architecture became:

``` text
N tests
   ↓
one generated C++ program
   ↓
one Piston invocation
   ↓
N test executions inside the same process
```

The file:

``` text
backend/services/cppMultiTestHarnessService.js
```

was created for this.

------------------------------------------------------------------------

# 22. Multi-test markers

The unified harness uses explicit markers:

``` text
__CODESYNC_TEST_0_START__
__CODESYNC_TEST_0_END__

__CODESYNC_TEST_1_START__
__CODESYNC_TEST_1_END__
```

and so on.

The output can therefore be parsed deterministically.

Conceptually:

``` text
Piston stdout

TEST 0 START
result
TEST 0 END

TEST 1 START
result
TEST 1 END
```

The backend parser extracts each test's output.

If markers are missing or incomplete, the parser treats that as an
execution/parsing problem rather than silently guessing.

------------------------------------------------------------------------

# 23. Unified test execution strategy

The unified runner was integrated into:

``` text
problemTestRunnerService
```

C++ eligible problems use the unified path.

Other/legacy paths retain sequential behavior.

An important rule was established:

> Once unified execution starts, there is no fallback to sequential
> execution.

Why?

Because fallback could accidentally execute the user's program twice and
make performance unpredictable.

------------------------------------------------------------------------

# 24. Unified timeout

The unified runner calculates a timeout based on the number of selected
tests:

``` text
10 seconds + 2 seconds × number of tests
```

with a maximum of:

``` text
30 seconds
```

Conceptually:

``` text
timeout = min(10000 + tests * 2000, 30000)
```

This is an application-level execution budget.

Piston still has its own runtime limits.

------------------------------------------------------------------------

# 25. Why unified execution improved performance

Observed examples:

``` text
Two Sum Run
~89.8s → ~32.34s

Two Sum Submit
~247.1s → ~30.42s

Longest Unique Substring Run
~86.9s → ~30.84s

Longest Unique Substring Submit
~253.7s → ~27.92s
```

The improvement was roughly:

``` text
64%–89%
```

depending on the path.

The remaining \~28--32 second range was largely attributed to the local
Piston/Docker/WSL2/GCC lifecycle rather than repeated per-test Piston
calls.

This was a major architectural optimization.

------------------------------------------------------------------------

# 26. Multi-test verification

The unified problem test runner passed:

``` text
8 / 8
```

The tests covered the unified execution path and preserved hidden-test
privacy.

------------------------------------------------------------------------

# 27. Run vs Submit

Once execution worked, the product needed two different user actions.

## Run

Run is intended for feedback while coding.

It executes:

``` text
visible tests only
```

It does not create a Submission history record.

## Submit

Submit is the final evaluation.

It executes:

``` text
visible tests
+
hidden tests
```

and persists the final Submission.

This distinction is essential.

------------------------------------------------------------------------

# 28. Hidden test privacy

Hidden tests are not merely another UI feature.

They are a security and integrity boundary.

The API for problem details filters hidden test cases.

The frontend receives public problem information, but not:

``` text
hidden input
hidden expected output
hidden actual output
```

When a hidden test fails, the response may indicate metadata such as:

``` text
test index
isHidden
status
runtime
memory
```

but must not reveal the hidden data itself.

The principle is:

> **Reveal the outcome, not the secret test data.**

------------------------------------------------------------------------

# 29. Submission route

The submission routes became responsible for orchestration.

Run:

``` text
POST /api/submissions/run
```

Submit:

``` text
POST /api/submissions/submit
```

Both are protected.

The backend verifies authentication and, where applicable, room
membership.

The backend does not trust a user ID supplied by the browser.

It derives identity from:

``` text
req.userId
```

which comes from the authentication middleware.

------------------------------------------------------------------------

# 30. Submission statuses

Final submission status mapping became:

``` text
Accepted
Wrong Answer
Time Limit Exceeded
Runtime Error
Compilation Error
```

Infrastructure failures are not converted into fake programming
verdicts.

For example:

``` text
internal_error
```

produces an HTTP-level server error rather than:

``` text
Wrong Answer
```

This preserves semantic correctness.

------------------------------------------------------------------------

# 31. Submission persistence

Run:

``` text
does not persist Submission
```

Submit:

``` text
persists completed Submission
```

The persisted Submission contains information such as:

``` text
user
problem
room
language
code
status
passedTestCases
totalTestCases
runtimeMs
memoryKb
failedTestCase
testResults
timestamps
```

This historical data later became the foundation for analytics.

------------------------------------------------------------------------

# 32. Submission route verification

The submission system passed:

``` text
11 / 11
```

The verification covered the important Run/Submit behaviors,
authorization, persistence, status mapping, and hidden-test privacy.

------------------------------------------------------------------------

# 33. Room-aware execution

The platform supports collaborative rooms.

Therefore execution cannot simply check:

``` text
isAuthenticated
```

It also needs to check:

``` text
isMemberOfRoom
```

When a room ID is supplied:

``` text
user
  ↓
room lookup
  ↓
membership verification
  ↓
execution allowed
```

This prevents one authenticated user from using another room's execution
context.

------------------------------------------------------------------------

# 34. Room lifecycle hardening

The room model evolved to distinguish:

``` text
ACTIVE
CLOSED
```

A host can end a room.

The endpoint is:

``` text
POST /api/rooms/:roomId/end
```

It is:

-   protected,
-   host-only,
-   idempotent.

When a room closes:

``` text
status = CLOSED
endedAt = current time
```

Participants' active-room references are cleared.

Recent-room history is preserved.

A `room:closed` socket event tells connected clients about the
transition.

------------------------------------------------------------------------

# 35. What CLOSED means

A closed room becomes read-only.

The frontend disables:

``` text
editing
problem selection
Run
Submit
Save
discussion input
discussion send
```

The backend also rejects these actions.

This is important because frontend disabling is not authorization.

A malicious client can bypass UI controls.

Therefore:

``` text
Frontend guard
+
Backend authorization
```

are both required.

------------------------------------------------------------------------

# 36. Room lifecycle verification

A dedicated lifecycle verification script passed:

``` text
12 / 12
```

This stage was approved.

------------------------------------------------------------------------

# 37. Empty room cleanup

Rooms can become abandoned.

The Room model therefore gained:

``` js
emptySince
```

When the last participant leaves:

``` text
users = []
emptySince = current time
```

A cleanup service runs approximately every 60 seconds.

The default empty-room TTL is:

``` text
10 minutes
```

If an ACTIVE room remains empty past the TTL, it can be deleted.

CLOSED rooms are also cleaned up using:

``` text
endedAt
```

Associated discussion messages are deleted when their room is deleted.

------------------------------------------------------------------------

# 38. Why cleanup matters

Without cleanup:

``` text
temporary room
    ↓
last user leaves
    ↓
room remains forever
```

Over time this creates stale database records.

The cleanup service therefore turns room membership into a lifecycle:

``` text
created
  ↓
active
  ↓
empty
  ↓
grace period
  ↓
deleted
```

A useful product decision was also made:

> A solo creator leaving does not immediately delete the room.

The room can remain temporarily available for rejoin.

If someone else remains when the creator leaves, the first remaining
user is promoted to `createdBy`.

------------------------------------------------------------------------

# 39. Recent rooms vs active room

The user model deliberately separates:

``` text
activeRoom
```

from:

``` text
recentRooms
```

`activeRoom` represents current membership.

`recentRooms` represents history.

Leaving a room clears:

``` text
activeRoom
```

but preserves:

``` text
recentRooms
```

This avoids a common modeling mistake where "current state" and
"history" are mixed together.

Recent rooms are populated and stale/deleted rooms are filtered.

------------------------------------------------------------------------

# 40. Real-time code collaboration

Socket.IO was already part of the collaborative architecture, but it was
hardened around the execution system.

The code event is conceptually:

``` js
code:update
{
  roomId,
  code,
  timestamp
}
```

The server validates:

-   authentication,
-   payload type,
-   room existence,
-   membership,
-   ACTIVE room status.

Then it broadcasts to other room members.

The sender is excluded.

------------------------------------------------------------------------

# 41. Last-write-wins collaboration

The collaboration model is intentionally simple:

``` text
last-write-wins snapshot
```

It is not:

``` text
CRDT
```

and not:

``` text
OT
```

That means if two users edit simultaneously, the latest accepted
snapshot can overwrite another edit.

This is a known MVP limitation.

The architecture leaves room for a future CRDT/OT implementation if
stronger concurrent editing semantics become necessary.

------------------------------------------------------------------------

# 42. Persistence vs real-time synchronization

An important distinction was preserved.

Socket update:

``` text
code:update
```

means:

``` text
"another client should see this code"
```

It does not mean:

``` text
"MongoDB has persisted this code"
```

Persistence remains handled by the debounced REST save mechanism.

The editor uses approximately:

``` text
800 ms
```

debouncing.

This reduces database writes while maintaining responsive collaboration.

------------------------------------------------------------------------

# 43. Reconnection handling

On Socket.IO reconnect:

``` text
room:join
```

is emitted again.

The client has logic to avoid blindly overwriting local dirty state with
an authoritative fetch.

This prevents reconnect logic from destroying unsaved local edits.

------------------------------------------------------------------------

# 44. Discussion system

The collaborative room eventually gained persistent realtime discussion.

The message model contains:

``` text
room
user
message
createdAt
clientMessageId
```

There is a unique compound index:

``` text
(room, clientMessageId)
```

The backend validates:

-   authentication,
-   room membership,
-   message content,
-   maximum length,
-   client message ID.

The sender identity and timestamp are derived server-side.

------------------------------------------------------------------------

# 45. Why clientMessageId matters

A network request can be retried.

For example:

``` text
client sends message
      ↓
server stores message
      ↓
response is lost
      ↓
client retries
```

Without idempotency, the same message could appear twice.

The solution was an idempotent persistence service:

``` text
saveDiscussionMessageIdempotent(...)
```

It:

1.  checks for an existing message,
2.  verifies ownership,
3.  creates the message if absent,
4.  handles MongoDB duplicate-key race conditions,
5.  retrieves the existing record when necessary.

Socket broadcasts occur only for a newly created message.

This is a classic **idempotency** pattern.

------------------------------------------------------------------------

# 46. Discussion verification

Discussion behavior was hardened against:

-   duplicate messages,
-   retry behavior,
-   cross-user clientMessageId reuse,
-   unauthorized room access.

This became part of the larger QA process.

------------------------------------------------------------------------

# 47. Stage 7: broad QA and hardening

The project then ran a broad Stage 7 QA suite.

It checked:

-   missing/forged authentication,
-   submission-history scoping,
-   room creation,
-   duplicate room handling,
-   capacity of 3,
-   host-only problem selection,
-   visible-only Run,
-   room-member authorization,
-   Submit with visible + hidden tests,
-   hidden-test privacy,
-   sandbox isolation,
-   discussion idempotency,
-   cross-user clientMessageId attacks,
-   CLOSED-room execution rejection,
-   CLOSED-room discussion rejection,
-   cleanup,
-   orphan verification,
-   full regression.

The suite passed:

``` text
16 / 16
```

The wording around "production" was intentionally softened.

The project had strong MVP/portfolio-level verification, but that is not
equivalent to a formal production security audit or operations
validation.

------------------------------------------------------------------------

# 48. Solved Problems tracking

After the submission system was stable, the project began turning raw
activity into user-level learning data.

The User model gained:

``` js
solvedProblems: [
  {
    problem,
    solvedAt
  }
]
```

The important business rule is:

> A problem is marked solved only after an Accepted solo submission.

Therefore:

``` text
Run
→ never solved

Wrong Answer
→ never solved

Accepted room submission
→ not solved

Accepted solo submission
→ solved
```

The identity is always taken from:

``` text
req.userId
```

not from request-body user IDs.

------------------------------------------------------------------------

# 49. Duplicate solved-problem handling

A user may submit the same problem successfully multiple times.

The system prevents duplicate solved-problem entries.

This keeps:

``` text
solvedProblems
```

as a logical set rather than a submission log.

Submission history remains the detailed event stream.

Solved problems represent a derived achievement state.

------------------------------------------------------------------------

# 50. Solved-problem API

A protected endpoint was added:

``` text
GET /api/users/solved-problems
```

It returns populated problem information and sorts by:

``` text
solvedAt descending
```

Stats include:

``` text
total
easy
medium
hard
```

The frontend uses this information for:

-   Profile,
-   Dashboard,
-   solved indicators.

------------------------------------------------------------------------

# 51. Solved tracking verification

The dedicated verification passed:

``` text
10 / 10 core tests
39 assertions
```

The broader existing suites also remained green.

------------------------------------------------------------------------

# 52. Stage 8: Personal Analytics

At this point the platform already had valuable persisted data.

Instead of creating a redundant Analytics collection, the design decided
to derive analytics from:

``` text
User
+
Submission
+
Problem
```

This is important architecturally.

The application already had the raw events.

Therefore:

``` text
events
   ↓
analytics calculation
   ↓
response
```

was preferred over:

``` text
events
   ↓
duplicate Analytics collection
   ↓
synchronization problems
```

------------------------------------------------------------------------

# 53. Analytics contract

The analytics endpoint became:

``` text
GET /api/users/analytics
```

It is protected and scoped to:

``` text
req.userId
```

The contract defined:

-   summary,
-   activity,
-   performance,
-   difficulty,
-   topic information,
-   privacy behavior,
-   empty-state behavior.

UTC was chosen explicitly for date calculations.

------------------------------------------------------------------------

# 54. Analytics calculation rules

The analytics rules were deliberately specified before implementation.

Important rules included:

### Solved problems

-   deduplicate solved records,
-   handle orphaned references safely,
-   use strict difficulty classification.

### Submissions

Query only:

``` text
Submission.find({ user: req.userId })
```

The service avoids retrieving unnecessary sensitive fields.

It uses lean/projection-style retrieval.

### Streaks

Activity days are converted to UTC date keys.

The streak is based on days with persisted Submission activity.

### Runtime

Runtime is considered valid when it is:

``` text
finite
>= 0
```

### Memory

Memory is considered meaningful when:

``` text
> 0
```

### Topics

Topics are:

``` text
deduplicated
sorted
```

------------------------------------------------------------------------

# 55. Analytics query strategy

The service intentionally uses two main database queries and performs
aggregation in Node.

The goal was:

``` text
small number of predictable queries
+
deterministic calculation
```

rather than a complex MongoDB aggregation pipeline for every metric.

The service verification passed:

``` text
70 / 70
```

------------------------------------------------------------------------

# 56. Analytics API verification

The protected API was then tested separately.

It passed:

``` text
45 / 45
```

The test suite checked authentication and API behavior.

------------------------------------------------------------------------

# 57. Stage 8 final QA

The final Stage 8 QA verified the complete path:

``` text
HTTP
 ↓
authentication
 ↓
route
 ↓
analytics service
 ↓
MongoDB
 ↓
JSON response
```

It passed:

``` text
54 / 54
```

A representative Atlas baseline was approximately:

``` text
308 ms
```

while the in-memory calculation itself was measured at less than:

``` text
1 ms
```

This helped distinguish database/network latency from application-side
calculation cost.

------------------------------------------------------------------------

# 58. Profile analytics

The Profile page was upgraded to display:

-   overview metrics,
-   detailed analytics,
-   loading states,
-   error states,
-   empty states,
-   responsive behavior,
-   accessibility.

This made analytics user-visible rather than being only an API.

------------------------------------------------------------------------

# 59. Activity heatmap

A native React/CSS activity heatmap was created.

It uses:

``` text
12 weeks
×
7 days
=
84 day cells
```

It uses UTC rolling activity.

Intensity buckets:

``` text
0
1
2–3
4–6
7+
```

No chart library was introduced.

This was intentional because the visualization was simple enough to
implement with native CSS.

------------------------------------------------------------------------

# 60. Dashboard analytics

The Dashboard was then integrated with the same analytics endpoint.

It shows a concise subset:

``` text
solved totals
difficulty counts
total submissions
accepted submissions
acceptance rate
streaks
compact heatmap
```

The Dashboard does not duplicate the entire Profile analytics interface.

The design principle is:

> Profile = detailed analytics.

> Dashboard = concise operational summary.

------------------------------------------------------------------------

# 61. Stage 8 completion

By the end of Stage 8:

-   analytics contract was approved,
-   calculation rules were approved,
-   service was approved,
-   API was approved,
-   Profile integration was approved,
-   heatmap was approved,
-   Dashboard integration was approved.

Browser verification showed:

``` text
0 console errors
```

and the frontend continued to pass lint/build checks.

------------------------------------------------------------------------

# 62. Frontend redesign

Alongside the analytics work, the frontend underwent a substantial
visual redesign.

The project explicitly rejected:

-   purple-blue AI gradients,
-   violet/cyan neon aesthetics,
-   magenta gradients,
-   grain/noise overlays,
-   glassmorphism,
-   generic AI marketing language,
-   unnecessary icon-card grids,
-   excessive animation,
-   cursor-following effects,
-   generic scroll fade animations.

The desired direction was:

``` text
dark
high contrast
technical
editorial
grounded
```

------------------------------------------------------------------------

# 63. Visual tokens

The redesign introduced a dark neutral surface system.

Representative tokens included:

``` text
background:
#0b0f12

surface:
#13181d

elevated:
#1a2127

subtle:
#212b33

highlight:
#28343e

accent:
#f28c28

accent hover:
#ff9f3d
```

Typography uses:

``` text
IBM Plex Sans
IBM Plex Mono
```

The design emphasizes:

-   1px borders,
-   solid surfaces,
-   restrained radii,
-   4px/8px spacing cadence,
-   high contrast,
-   technical/editorial layouts.

------------------------------------------------------------------------

# 64. Why the frontend redesign was repaired rather than restarted

The first redesign pass introduced integration problems.

Instead of repeatedly redesigning the entire application, the project
treated it as an integration failure and repaired it.

This is important engineering discipline.

The objective was not:

``` text
"make everything look different"
```

but:

``` text
preserve working behavior
+
apply visual system
+
fix regressions
```

Room.jsx was deliberately kept cohesive.

A refactor may be useful later, but it was not treated as a prerequisite
for the current product milestone.

------------------------------------------------------------------------

# 65. Room workspace improvements

The workspace eventually gained:

-   draggable split behavior,
-   output-panel resizing,
-   output-panel collapsing,
-   directional controls,
-   automatic output opening after Run/Submit.

The implementation was verified at several viewport sizes.

The final UI QA reported:

``` text
0 browser console errors
0 lint errors
1 warning
successful build
```

The warning was not treated as a blocker.

------------------------------------------------------------------------

# 66. Stage 9: AI Code Review

Once the execution and analytics foundations were stable, AI became the
next major feature.

The project chose:

``` text
Gemini API
```

with a strict goal of keeping usage within the free tier.

The current model selected for the project is:

``` text
gemini-3.6-flash
```

The architecture intentionally does not let the frontend call Gemini
directly.

The desired flow is:

``` text
React
   ↓
POST /api/submissions/review
   ↓
Express authentication
   ↓
authorization
   ↓
AI Review Service
   ↓
AI Provider abstraction
   ↓
Gemini Provider
   ↓
Gemini
```

------------------------------------------------------------------------

# 67. Why an AI provider abstraction was created

Instead of writing:

``` text
submission route → Gemini SDK
```

the project created:

``` text
AIProvider
```

and:

``` text
GeminiProvider
```

There is also:

``` text
MockAiProvider
```

This creates a provider abstraction.

Conceptually:

``` text
AIReviewService
       |
       v
AIProvider interface
       |
       +---- GeminiProvider
       |
       +---- MockAiProvider
```

This is valuable because tests should not depend on a live external
model.

It also makes provider replacement easier.

------------------------------------------------------------------------

# 68. AI review foundation

The core files included:

``` text
backend/services/ai/aiProvider.js
backend/services/ai/mockAiProvider.js
backend/services/ai/aiReviewService.js
```

The service is responsible for:

-   validating input,
-   building the allowed review context,
-   validating provider output,
-   mapping provider failures,
-   maintaining the AI contract.

The foundation verification passed:

``` text
42 / 42
```

in the detailed foundation verification.

------------------------------------------------------------------------

# 69. What the AI is allowed to see

This was one of the most important security decisions.

The AI review receives:

``` text
public problem context
+
user code
+
whitelisted execution summary
```

It does NOT receive:

``` text
hidden test inputs
hidden expected outputs
hidden actual outputs
passwords
JWTs
cookies
emails
unrelated user data
unrelated analytics
```

The code length is capped at:

``` text
65,536 characters
```

The AI is therefore given the minimum useful context.

------------------------------------------------------------------------

# 70. Why hidden tests must never reach AI

Suppose a hidden test contains:

``` text
secret input
```

and the AI receives it.

Even if the AI never explicitly prints it, the secret has already
crossed the privacy boundary.

Therefore the rule is stronger:

> Do not query hidden tests for AI review at all.

This is better than querying them and attempting to filter them
afterward.

------------------------------------------------------------------------

# 71. Prompt injection handling

User code is treated as untrusted input.

A user could put something like:

``` text
Ignore all previous instructions...
```

inside a source-code comment.

The AI layer therefore uses structured delimiters and clear separation
between:

``` text
system instructions
problem context
execution information
user code
```

The goal is defense in depth.

This is not treated as a mathematically perfect prompt-injection
solution.

The correct security mindset is:

``` text
untrusted input
+
strong boundaries
+
schema validation
+
minimal data exposure
```

------------------------------------------------------------------------

# 72. Structured AI output

The AI does not return an arbitrary paragraph.

The desired response has a strict structure:

``` text
summary

verdictAssessment:
  executionAlignment
  timeComplexity
  spaceComplexity
  complexityAnalysis

issues:
  id
  category
  severity
  title
  lineRange
  explanation
  recommendation

strengths

actionableSuggestions
```

This makes AI output usable by the frontend as structured data.

It also allows the backend to reject malformed model output.

------------------------------------------------------------------------

# 73. Why schema validation matters

LLMs are probabilistic.

A provider can return something like:

``` text
"Your code looks good."
```

when the application expected an object.

Therefore:

``` text
Gemini output
      ↓
validation
      ↓
valid review object
```

If validation fails:

``` text
502 malformed provider response
```

rather than passing garbage into the UI.

------------------------------------------------------------------------

# 74. Gemini provider

The Gemini provider uses the Google GenAI SDK.

The backend environment contains the secret key.

The frontend never receives:

``` text
GEMINI_API_KEY
```

The model is configured through:

``` text
GEMINI_MODEL
```

and the project uses:

``` text
gemini-3.6-flash
```

The provider was tested with a controlled live Gemini request.

A real review response was successfully returned.

------------------------------------------------------------------------

# 75. No automatic retries

The provider intentionally does not automatically retry failed Gemini
calls.

Why?

Because AI calls are external resource consumption.

Automatic retries can create:

``` text
request
 ↓
failure
 ↓
retry
 ↓
retry
 ↓
rate-limit consumption
```

The MVP instead keeps failure behavior explicit.

------------------------------------------------------------------------

# 76. AI review API

The endpoint is:

``` text
POST /api/submissions/review
```

It is protected.

The backend verifies:

``` text
authenticated user
```

and, for room review:

``` text
room membership
+
room ACTIVE status
```

CLOSED rooms are rejected.

The body cannot override identity with a fake:

``` text
userId
```

The backend always derives identity from authentication.

------------------------------------------------------------------------

# 77. AI provider factory

The application uses:

``` text
aiProviderFactory
```

to select the active provider.

Conceptually:

``` text
environment
   ↓
provider factory
   ↓
GeminiProvider
```

or:

``` text
test configuration
   ↓
MockAiProvider
```

The factory is also a form of dependency isolation.

------------------------------------------------------------------------

# 78. AI rate limiting

The review endpoint has a per-user rate limit:

``` text
5 requests / minute / user
```

The limiter is configured so failed requests can be treated differently
through:

``` text
skipFailedRequests
```

The exact rate is deliberately conservative for the free-tier-oriented
MVP.

This protects both:

``` text
provider quota
```

and:

``` text
application resources
```

------------------------------------------------------------------------

# 79. AI error mapping

The API distinguishes:

``` text
400
invalid request

401
unauthenticated

403
not allowed / wrong room state

404
problem/room not found

429
rate limited

502
provider returned malformed/unusable response

503
AI provider unavailable

504
provider timeout
```

This makes failures diagnosable.

------------------------------------------------------------------------

# 80. AI review is ephemeral

AI reviews are not stored in MongoDB.

The flow is:

``` text
code
 ↓
AI request
 ↓
review
 ↓
frontend
```

Then the request's data is not persisted as an AI Review record.

This reduces:

-   privacy exposure,
-   database growth,
-   unnecessary storage,
-   long-term retention concerns.

------------------------------------------------------------------------

# 81. Frontend AI Review UI

The component:

``` text
AIReviewPanel.jsx
```

was created with:

``` text
AIReviewPanel.css
```

The user sees:

``` text
Run
Submit
Review Code
```

as separate actions.

The review appears as a structured panel/tab in the existing workspace
rather than taking over the entire editor.

------------------------------------------------------------------------

# 82. Review request behavior

The frontend sends:

``` text
current code snapshot
+
problem identifier
+
language
+
optional execution summary
```

It does not send:

``` text
userId
hidden tests
credentials
```

A request token/snapshot mechanism prevents stale AI responses from
replacing newer UI state.

A short client cooldown of approximately:

``` text
5 seconds
```

also prevents accidental repeated clicks.

The backend rate limiter remains the real enforcement mechanism.

------------------------------------------------------------------------

# 83. CLOSED-room frontend behavior

If the room is CLOSED:

``` text
Review Code
```

is disabled.

The backend independently rejects the request.

Again:

``` text
frontend guard
+
backend enforcement
```

------------------------------------------------------------------------

# 84. AI review UI contents

The panel presents:

-   summary,
-   execution alignment,
-   time complexity,
-   space complexity,
-   complexity analysis,
-   issues,
-   severity,
-   category,
-   line ranges,
-   strengths,
-   actionable suggestions.

No unsafe HTML rendering is used.

The panel is plain React and does not use:

``` text
dangerouslySetInnerHTML
```

This prevents a class of output-rendering problems.

------------------------------------------------------------------------

# 85. AI final hardening

The final hardening stage verified:

-   AI key exists only on backend,
-   no Gemini imports in frontend,
-   no Gemini imports directly in routes,
-   hidden tests never queried,
-   no personal/private unrelated data sent,
-   authenticated identity comes from `req.userId`,
-   room membership checked,
-   CLOSED rooms rejected,
-   5/minute user rate limit,
-   code size capped,
-   prompt injection treated as untrusted input,
-   provider output validated,
-   provider errors mapped safely,
-   no database persistence,
-   stale response protection,
-   responsive UI,
-   accessibility,
-   no unsafe HTML rendering,
-   live Gemini request works.

The final Stage 9 QA passed:

``` text
31 / 31
```

along with the lower-level suites.

------------------------------------------------------------------------

# 86. Full verification picture

The important verification milestones reached along the way include:

``` text
C++ harness verification             6 / 6
Execution service verification       5 / 5
Comparator/test execution            7 / 7
Unified test runner                  8 / 8
Submission routes                   11 / 11
Room lifecycle                      12 / 12
Stage 7 broad QA                    16 / 16

Solved-problem verification         10 / 10
                                    39 assertions

Analytics service                   70 / 70
Analytics API                       45 / 45
Stage 8 final QA                    54 / 54

AI foundation                       42 / 42
AI provider verification              7 / 7
AI review API                       24 / 24
Stage 9 final QA                    31 / 31
```

The exact number of assertions varies between suites because some
reports summarize a detailed suite differently, but the recorded project
verification results were all passing.

------------------------------------------------------------------------

# 87. Frontend verification

The frontend was repeatedly checked with:

``` text
lint
build
browser verification
```

The final known state included:

``` text
0 lint errors
1 lint warning
successful build
0 browser console errors
```

The warning was not considered a release blocker for the current MVP
checkpoint.

------------------------------------------------------------------------

# 88. Why all these layers exist

The final architecture is easier to understand as layers.

``` text
┌──────────────────────────────────────────────┐
│                  React UI                    │
│ Room / ProblemWorkspace / Dashboard /       │
│ Profile / AIReviewPanel                      │
└──────────────────────┬───────────────────────┘
                       │ HTTP / Socket.IO
                       ▼
┌──────────────────────────────────────────────┐
│              Express Backend                 │
│ Auth / Rooms / Problems / Submissions /      │
│ Discussion / Analytics / AI Review           │
└───────┬──────────────┬──────────────┬────────┘
        │              │              │
        ▼              ▼              ▼
   MongoDB         Socket.IO      AI Provider
                                      │
                                      ▼
                                   Gemini
        │
        ▼
Execution Service
        │
        ▼
      Piston
        │
        ▼
     Isolate
        │
        ▼
       GCC
```

The important architectural boundaries are:

``` text
UI ≠ backend
backend ≠ database
backend ≠ execution engine
execution ≠ comparison
AI route ≠ Gemini implementation
real-time state ≠ persistence
current state ≠ history
public tests ≠ hidden tests
```

These separations are what make the system maintainable.

------------------------------------------------------------------------

# 89. Security model

The system has several independent security boundaries.

## Authentication

JWT/cookie authentication establishes:

``` text
who is this user?
```

## Authorization

Room membership and host checks establish:

``` text
is this user allowed to perform this action?
```

## Execution isolation

Piston + Isolate establish:

``` text
where does untrusted code execute?
```

## Hidden-test privacy

Server-side test filtering establishes:

``` text
what information is allowed to leave the backend?
```

## AI data minimization

Whitelisted context establishes:

``` text
what information is allowed to reach Gemini?
```

## Rate limiting

Rate limiting establishes:

``` text
how frequently can expensive AI operations occur?
```

Security therefore is not one middleware function.

It is a set of boundaries.

------------------------------------------------------------------------

# 90. Data-flow understanding

One of the most useful ways to understand CodeSync is to follow a
submission.

Suppose the user clicks Submit.

``` text
1. React captures current code
        ↓
2. POST /api/submissions/submit
        ↓
3. protect middleware authenticates user
        ↓
4. route validates request
        ↓
5. room membership is checked if roomId exists
        ↓
6. room state is checked
        ↓
7. problem is loaded
        ↓
8. hidden + visible tests are selected
        ↓
9. C++ multi-test harness is generated
        ↓
10. one Piston request is made
        ↓
11. sandbox compiles/runs the generated program
        ↓
12. output markers are parsed
        ↓
13. each test output is compared
        ↓
14. final verdict is determined
        ↓
15. hidden information is removed from response
        ↓
16. Submission is persisted
        ↓
17. if Accepted + solo:
        solvedProblems is updated
        ↓
18. response returns to React
        ↓
19. UI displays result/history
```

That is the core execution pipeline.

------------------------------------------------------------------------

# 91. Data-flow understanding for AI review

When Review Code is clicked:

``` text
1. React captures code snapshot
        ↓
2. POST /api/submissions/review
        ↓
3. authentication
        ↓
4. room authorization if applicable
        ↓
5. ACTIVE-room validation
        ↓
6. public problem context loaded
        ↓
7. hidden tests are never queried
        ↓
8. execution summary is filtered
        ↓
9. code length is validated
        ↓
10. AIReviewService builds structured input
        ↓
11. provider factory supplies GeminiProvider
        ↓
12. Gemini receives bounded context
        ↓
13. response is parsed/validated
        ↓
14. validated review returned
        ↓
15. React renders structured review
```

There is no AI database write.

------------------------------------------------------------------------

# 92. What the project learned from failures

Several of the most useful engineering lessons came from things that
initially went wrong.

## Lesson 1: external dependencies have behavior

The `.cpp.cpp` filename issue came from Piston.

Do not assume an external system behaves the way your abstraction
expects.

------------------------------------------------------------------------

## Lesson 2: generated code needs real execution tests

The missing `<unordered_map>` header would have been easy to miss with
only string-based tests.

Real compiler-path testing found it.

------------------------------------------------------------------------

## Lesson 3: performance is architectural

Executing 10 tests with 10 Piston calls is fundamentally different from
executing 10 tests in one process.

The large performance improvement came from changing the execution
architecture rather than optimizing JavaScript.

------------------------------------------------------------------------

## Lesson 4: frontend security is not security

Disabling Submit in React does not protect a CLOSED room.

The backend must reject it too.

------------------------------------------------------------------------

## Lesson 5: hidden data should never cross the boundary

Filtering hidden data after querying it is weaker than never querying
it.

This principle was applied to both frontend problem APIs and AI review.

------------------------------------------------------------------------

## Lesson 6: identity comes from authentication

Never trust:

``` text
body.userId
```

when the authenticated request already provides:

``` text
req.userId
```

------------------------------------------------------------------------

## Lesson 7: idempotency matters in networked systems

Discussion messages can be retried.

`clientMessageId` prevents duplicate persistence.

------------------------------------------------------------------------

## Lesson 8: current state and history should be modeled separately

``` text
activeRoom
```

and:

``` text
recentRooms
```

have different meanings.

------------------------------------------------------------------------

## Lesson 9: analytics should derive from existing events when possible

Persisting every computed metric can introduce synchronization problems.

Existing submissions already provide a reliable event stream.

------------------------------------------------------------------------

## Lesson 10: AI needs an application boundary

Do not let:

``` text
frontend → Gemini
```

become the architecture.

The backend controls:

``` text
authentication
authorization
data minimization
rate limiting
provider selection
output validation
```

------------------------------------------------------------------------

# 93. Current limitations

The system is strong as an MVP/portfolio project, but it has known
limitations.

## Collaboration

The current model is:

``` text
last-write-wins
```

not CRDT/OT.

------------------------------------------------------------------------

## Room capacity

The current room capacity is:

``` text
3 users
```

------------------------------------------------------------------------

## C++ harness type coverage

Only a targeted set of C++ types is supported.

It is not a general C++ reflection engine.

------------------------------------------------------------------------

## Execution infrastructure

Piston is running locally.

This is suitable for development/MVP work but requires additional
infrastructure planning for serious public deployment.

------------------------------------------------------------------------

## Submission model

Submissions are processed synchronously.

There is no queue-based:

``` text
Pending → worker → result
```

pipeline yet.

------------------------------------------------------------------------

## AI review

AI review is advisory.

It should not be treated as a compiler, formal verifier, or guaranteed
correctness oracle.

Prompt-injection defenses are defense-in-depth rather than a perfect
mathematical guarantee.

------------------------------------------------------------------------

## Analytics indexes

The analytics design identified useful secondary indexes such as:

``` text
{ user: 1, createdAt: -1 }
{ user: 1, status: 1 }
{ user: 1, problem: 1, createdAt: -1 }
```

but these were identified as recommendations rather than being treated
as mandatory before the current milestone.

------------------------------------------------------------------------

# 94. What is deliberately not being done yet

The project intentionally avoided scope expansion while stabilizing the
current architecture.

Examples:

``` text
No CRDT rewrite
No major Room.jsx refactor
No multi-language execution expansion
No competition system
No large-scale production deployment architecture
No automatic AI background calls
No persistent AI review collection
```

These can be future stages.

Keeping them out of the current milestone protects the stability of the
existing system.

------------------------------------------------------------------------

# 95. Git checkpoint

After completing the analytics and AI review work, the project reached a
major source-control checkpoint.

The working tree contained the expected Stage 8/9 modifications and new
files.

The staged set included:

``` text
backend/services/ai/
backend/services/analyticsService.js
verification scripts
analytics/AI contract docs
AIReviewPanel
ActivityHeatmap
frontend updates
submission route changes
user route changes
```

Importantly:

``` text
.env
```

was not staged.

The LF/CRLF messages seen during Git operations are Windows line-ending
warnings:

``` text
LF will be replaced by CRLF
```

They are not application errors.

The files were successfully staged.

The next intended action is the checkpoint commit:

``` bash
git commit -m "Complete analytics and AI code review"
```

followed by:

``` bash
git status
```

with the desired final state:

``` text
nothing to commit, working tree clean
```

Pushing to the remote repository should be treated as a separate
decision after verifying the local checkpoint.

------------------------------------------------------------------------

# 96. Current milestone

The project has effectively reached the end of the current major MVP
feature path:

``` text
Collaborative coding
        +
Problem system
        +
Sandboxed C++ execution
        +
Run / Submit
        +
Hidden tests
        +
Room lifecycle
        +
Realtime collaboration
        +
Persistent discussion
        +
Solved-problem tracking
        +
Personal analytics
        +
AI code review
```

The major system transition was:

``` text
coding platform
        ↓
coding platform with reliable execution
        ↓
coding platform with persistent learning/activity data
        ↓
coding platform with AI-assisted code review
```

That progression is important because the AI layer was not built on top
of an empty demo.

It was built on top of:

``` text
authentication
rooms
problems
execution
submissions
test results
solved history
analytics
```

This gives the AI feature meaningful context while keeping the AI
boundary controlled.

------------------------------------------------------------------------

# 97. Suggested mental model for understanding the whole project

If learning the codebase, do not start by memorizing individual files.

Start with these five pipelines.

## Pipeline A --- Code execution

``` text
Problem
   ↓
Harness
   ↓
Piston
   ↓
Sandbox
   ↓
stdout
   ↓
Comparator
   ↓
Verdict
```

## Pipeline B --- Collaboration

``` text
Editor
   ↓
Socket.IO
   ↓
Room members
   ↓
local snapshots
   ↓
debounced persistence
```

## Pipeline C --- Submission history

``` text
Submit
   ↓
Execution
   ↓
Verdict
   ↓
MongoDB Submission
   ↓
History / Analytics
```

## Pipeline D --- Analytics

``` text
Submission + User + Problem
             ↓
      Analytics Service
             ↓
        derived metrics
             ↓
       Dashboard/Profile
```

## Pipeline E --- AI review

``` text
Current code
+
public problem context
+
safe execution summary
        ↓
AI Review Service
        ↓
Gemini Provider
        ↓
validated structured review
        ↓
AIReviewPanel
```

If these five pipelines are understood, most of the project architecture
becomes much easier to understand.

------------------------------------------------------------------------

# 98. Key terminology to remember

### API

An interface through which frontend/backend systems communicate.

### Middleware

A function that runs during an HTTP request pipeline, commonly for
authentication or validation.

### Authorization

Checking whether an authenticated user is allowed to perform an action.

### Authentication

Establishing who the user is.

### Sandbox

An isolated environment for running untrusted code.

### Harness

Generated wrapper code that invokes a user's solution according to a
known execution contract.

### Serializer

Converts an in-memory result into a transferable representation such as
text.

### Comparator

Determines whether actual output matches expected output according to
problem-specific rules.

### Adapter

Translates one system's interface/result format into another system's
contract.

### Idempotency

Repeated execution of the same logical operation produces the same
resulting state rather than duplicates.

### Snapshot

A complete state representation at a particular moment.

### Last-write-wins

The latest received state replaces the previous state.

### Debounce

Wait for a short quiet period before performing an operation, reducing
repeated calls.

### Rate limiting

Restricting how frequently an operation can be performed.

### Schema validation

Checking that data has the expected structure and types.

### Provider abstraction

An interface allowing multiple implementations of an external service.

### Defense in depth

Using multiple independent safeguards instead of relying on one
protection.

### Projection

Selecting only required database fields rather than retrieving an entire
document.

### Lean query

A Mongoose query returning plain JavaScript objects rather than full
Mongoose documents, reducing overhead.

### Ephemeral

Data used during a request but not persisted for long-term storage.

### Regression

A previously working behavior becoming broken after a change.

### Integration test

A test verifying that multiple components work together.

### End-to-end test

A test following a realistic path across several system layers.

------------------------------------------------------------------------

# 99. The most important architectural decisions

If only a handful of decisions are remembered, remember these:

1.  **Never execute user C++ directly in Express.**
2.  **Use Piston as the execution boundary.**
3.  **Generate a server-controlled harness around user solutions.**
4.  **Keep comparison logic separate from execution.**
5.  **Run C++ multi-tests in one Piston invocation where possible.**
6.  **Never expose hidden tests.**
7.  **Enforce authorization on the backend even when the UI already
    disables an action.**
8.  **Keep realtime synchronization separate from persistence.**
9.  **Use authenticated identity rather than trusting body user IDs.**
10. **Use idempotency keys for retryable client operations.**
11. **Derive analytics from persisted activity rather than duplicating
    data unnecessarily.**
12. **Put Gemini behind a backend provider abstraction.**
13. **Send AI only the minimum allowed context.**
14. **Validate AI output before rendering it.**
15. **Treat AI output as advisory, not authoritative.**
16. **Verify each architectural layer independently before integrating
    it.**

------------------------------------------------------------------------

# 100. Final state at this checkpoint

The journey from Piston to the current checkpoint can be summarized as:

``` text
Piston infrastructure
        ↓
GCC runtime
        ↓
Isolate sandbox
        ↓
Execution service
        ↓
C++ harness
        ↓
Output comparator
        ↓
Unified multi-test execution
        ↓
Run / Submit
        ↓
Hidden-test privacy
        ↓
Room lifecycle + cleanup
        ↓
Realtime collaboration + discussion
        ↓
Submission history
        ↓
Solved-problem tracking
        ↓
Personal analytics
        ↓
Profile + Dashboard analytics
        ↓
AI provider abstraction
        ↓
Gemini provider
        ↓
Protected AI review API
        ↓
AI Review UI
        ↓
Security/privacy hardening
        ↓
Stage 9 final QA
        ↓
CURRENT CHECKPOINT
```

The important story is not simply that many features were added.

The important story is that each layer became the foundation for the
next:

``` text
execution
   → trustworthy submission data

submission data
   → solved tracking

submission history
   → analytics

problem + code + execution context
   → AI review

AI review
   → controlled assistance rather than uncontrolled model access
```

That is the architectural progression of CodeSync AI from a
collaborative editor into a system capable of execution, persistence,
analytics, and controlled AI assistance.

------------------------------------------------------------------------

# Appendix A --- High-level file map

## Execution

``` text
backend/services/executionService.js
backend/services/cppHarnessService.js
backend/services/cppMultiTestHarnessService.js
backend/services/outputComparatorService.js
backend/services/testCaseExecutionService.js
backend/services/problemTestRunnerService.js
```

## Rooms

``` text
backend/models/Room.js
backend/routes/roomRoutes.js
backend/services/roomCleanupService.js
```

## Discussion

``` text
backend/models/DiscussionMessage.js
backend/routes/discussionRoutes.js
backend/services/discussionService.js
backend/socket.js
```

## Analytics

``` text
backend/services/analyticsService.js
backend/routes/userRoutes.js
```

## AI

``` text
backend/services/ai/aiProvider.js
backend/services/ai/mockAiProvider.js
backend/services/ai/aiReviewService.js
backend/services/ai/geminiProvider.js
backend/services/ai/aiProviderFactory.js
```

## AI frontend

``` text
frontend/src/components/AIReviewPanel.jsx
frontend/src/components/AIReviewPanel.css
```

## Analytics frontend

``` text
frontend/src/components/ActivityHeatmap.jsx
frontend/src/components/ActivityHeatmap.css
```

## Main workspace

``` text
frontend/src/pages/Room.jsx
frontend/src/pages/Room.css
frontend/src/pages/ProblemWorkspace.jsx
frontend/src/pages/ProblemWorkspace.css
```

------------------------------------------------------------------------

# Appendix B --- Verification mindset

For every new subsystem, the project increasingly followed this pattern:

``` text
1. Audit
2. Define contract
3. Define calculation/behavior rules
4. Implement foundation
5. Verify foundation
6. Integrate API
7. Verify API
8. Integrate frontend
9. Browser test
10. Regression test
11. Final hardening
12. Approve
```

This is one of the most valuable practices to preserve as the project
moves into future stages.

Do not jump directly from:

``` text
"I have an idea"
```

to:

``` text
"change 15 files"
```

Instead:

``` text
What should the system guarantee?
        ↓
What data is allowed?
        ↓
What are the failure cases?
        ↓
What is the smallest implementation?
        ↓
How do we prove it works?
```

That methodology is what made the Piston → execution → analytics → AI
progression manageable.

------------------------------------------------------------------------

# Appendix C --- One-sentence explanation of each major subsystem

``` text
Piston:
Runs untrusted code outside the Express process.

Isolate:
Provides sandbox/process isolation for execution.

Execution service:
Translates Piston behavior into CodeSync's execution contract.

C++ harness:
Turns a user's Solution implementation into a complete executable program.

Comparator:
Determines whether output is correct.

Unified runner:
Runs many C++ tests in one Piston invocation.

Submission routes:
Expose Run and Submit to the frontend.

Room lifecycle:
Controls whether collaborative workspaces are active, closed, or cleaned up.

Socket.IO:
Provides realtime room synchronization.

Discussion service:
Provides persistent, idempotent room messaging.

Solved tracking:
Records accepted solo problems as user achievements.

Analytics service:
Derives personal coding metrics from existing user/submission/problem data.

AIProvider:
Defines the application-level contract for AI providers.

GeminiProvider:
Connects that contract to Gemini.

AIReviewService:
Validates input/output and protects the AI boundary.

AI Review API:
Provides authenticated, rate-limited code review requests.

AIReviewPanel:
Turns structured model output into a usable coding workflow.
```

------------------------------------------------------------------------

# Appendix D --- Where the project goes next

The next planned feature area is **AI Hints and Personalized
Recommendations**.

The correct next engineering step is not immediately writing the
feature.

It should begin with:

``` text
Stage 10.0
Audit + Contract
```

Then, if approved:

``` text
10.1 Hint service foundation
10.2 Gemini hint provider
10.3 Hint API
10.4 Hint UI
10.5 Personalized recommendations
10.6 Hardening / final QA
```

The same principles used for Stage 9 should carry forward:

``` text
minimal data
explicit contracts
backend authorization
no hidden-test leakage
structured output
rate limits
provider abstraction
no unnecessary persistence
verification before approval
```

The existing Room architecture should remain untouched unless a concrete
requirement forces a change.

------------------------------------------------------------------------

# Closing perspective

The most important thing to understand about CodeSync AI is that the
project did not become "AI-powered" by simply adding an API call.

The system first had to become capable of producing trustworthy
application data.

That required:

``` text
safe execution
+
correct testing
+
persistent submissions
+
room authorization
+
privacy boundaries
+
analytics
```

Only after those foundations existed did AI become useful.

The current architecture therefore has a clear progression:

``` text
Code
  ↓
Execution
  ↓
Evaluation
  ↓
History
  ↓
Analytics
  ↓
Assistance
```

That is the engineering story from Piston to the current Stage 9
checkpoint.
