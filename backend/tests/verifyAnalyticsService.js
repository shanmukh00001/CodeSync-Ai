/**
 * verifyAnalyticsService.js
 *
 * Comprehensive Automated Verification Suite for CodeSync AI Personal Analytics Service (Stage 8.3).
 *
 * Requirements & Edge Cases Covered:
 * 1. Zero submissions / new user
 * 2. One accepted submission
 * 3. Mixed submission statuses
 * 4. Solo + room submissions
 * 5. Acceptance rate calculation & rounding
 * 6. Multiple submissions same day
 * 7. Consecutive activity days
 * 8. Gap days in activity
 * 9. Today active streak
 * 10. Yesterday-only activity streak
 * 11. Longest historical streak
 * 12. Runtime average
 * 13. Fastest accepted runtime
 * 14. Memory average
 * 15. Null / invalid runtime handling
 * 16. Zero runtime handling
 * 17. Duplicate solved problems deduplication
 * 18. Orphan / deleted solved problem handling
 * 19. Duplicate tags per problem
 * 20. Tag multi-key sorting (count desc, alpha asc)
 * 21. Unexpected submission status resilience
 * 22. Privacy guarantee: No raw submission code/test fields returned
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");
const {
  getUserAnalytics,
  calculateStreaks,
  roundToOneDecimal,
  isValidRuntime,
  isValidMemory,
  toUtcDateString,
  stepPreviousUtcDay,
} = require("./services/analyticsService");

let passedCount = 0;
let failedCount = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  ❌ FAILED: ${message}`);
    failedCount++;
    throw new Error(message);
  } else {
    console.log(`  ✓ ${message}`);
    passedCount++;
  }
}

async function cleanupTestData(userEmails, problemSlugs) {
  if (userEmails && userEmails.length > 0) {
    const users = await User.find({ email: { $in: userEmails } });
    const userIds = users.map((u) => u._id);
    await Submission.deleteMany({ user: { $in: userIds } });
    await User.deleteMany({ email: { $in: userEmails } });
  }
  if (problemSlugs && problemSlugs.length > 0) {
    await Problem.deleteMany({ slug: { $in: problemSlugs } });
  }
}

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING STAGE 8.3 ANALYTICS SERVICE TEST SUITE");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI not found in environment variables.");
  }
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for testing.\n");

  const testEmails = [
    "analytics_empty_user@example.com",
    "analytics_active_user@example.com",
    "analytics_streak_user@example.com",
  ];

  const testProblemSlugs = [
    "analytics-prob-easy-1",
    "analytics-prob-med-1",
    "analytics-prob-hard-1",
  ];

  try {
    await cleanupTestData(testEmails, testProblemSlugs);

    // =========================================================
    // UNIT TESTS FOR PURE HELPER FUNCTIONS
    // =========================================================
    console.log("--- UNIT TESTS: Helper Functions ---");

    assert(roundToOneDecimal(66.666) === 66.7, "roundToOneDecimal rounds correctly (66.666 -> 66.7)");
    assert(roundToOneDecimal(0) === 0, "roundToOneDecimal handles 0");
    assert(roundToOneDecimal(NaN) === 0, "roundToOneDecimal handles NaN");

    assert(isValidRuntime(0) === true, "isValidRuntime accepts 0");
    assert(isValidRuntime(15.5) === true, "isValidRuntime accepts positive float");
    assert(isValidRuntime(-1) === false, "isValidRuntime rejects negative");
    assert(isValidRuntime(null) === false, "isValidRuntime rejects null");
    assert(isValidRuntime(NaN) === false, "isValidRuntime rejects NaN");
    assert(isValidRuntime(Infinity) === false, "isValidRuntime rejects Infinity");

    assert(isValidMemory(1024) === true, "isValidMemory accepts positive number");
    assert(isValidMemory(0) === false, "isValidMemory rejects 0");
    assert(isValidMemory(null) === false, "isValidMemory rejects null");

    assert(toUtcDateString("2026-09-14T23:59:59.000Z") === "2026-09-14", "toUtcDateString parses UTC correctly");
    assert(stepPreviousUtcDay("2026-09-14") === "2026-09-13", "stepPreviousUtcDay subtracts 1 day");
    assert(stepPreviousUtcDay("2026-03-01") === "2026-02-28", "stepPreviousUtcDay handles non-leap month boundary");

    // Pure Streak Unit Tests
    const s1 = calculateStreaks([], "2026-09-14");
    assert(s1.currentStreak === 0 && s1.longestStreak === 0, "Empty dates yields 0 current and 0 longest streak");

    const s2 = calculateStreaks(["2026-09-14"], "2026-09-14");
    assert(s2.currentStreak === 1 && s2.longestStreak === 1, "Today-only yields current=1, longest=1");

    const s3 = calculateStreaks(["2026-09-13"], "2026-09-14");
    assert(s3.currentStreak === 1 && s3.longestStreak === 1, "Yesterday-only yields current=1, longest=1");

    const s4 = calculateStreaks(["2026-09-12"], "2026-09-14");
    assert(s4.currentStreak === 0 && s4.longestStreak === 1, "2-day-old single activity yields current=0, longest=1");

    const s5 = calculateStreaks(
      ["2026-09-10", "2026-09-11", "2026-09-13", "2026-09-14"],
      "2026-09-14"
    );
    assert(s5.currentStreak === 2 && s5.longestStreak === 2, "Gap days streak yields current=2, longest=2");

    const s6 = calculateStreaks(
      ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-14"],
      "2026-09-14"
    );
    assert(s6.currentStreak === 1 && s6.longestStreak === 5, "Historical 5-day streak yields current=1, longest=5");

    console.log("");

    // =========================================================
    // TEST CASE 1: Empty User Analytics (Zero-Data State)
    // =========================================================
    console.log("--- TEST CASE 1: Empty / Zero-Data User ---");
    const emptyUser = await User.create({
      name: "Empty Analytics User",
      email: "analytics_empty_user@example.com",
      password: "hashed_password_test_123",
      solvedProblems: [],
    });

    const emptyResult = await getUserAnalytics(emptyUser._id);
    assert(emptyResult.solved.totalSolved === 0, "1.1 Solved total is 0");
    assert(emptyResult.solved.easy === 0, "1.2 Solved easy is 0");
    assert(emptyResult.solved.medium === 0, "1.3 Solved medium is 0");
    assert(emptyResult.solved.hard === 0, "1.4 Solved hard is 0");
    assert(emptyResult.submissions.total === 0, "1.5 Submissions total is 0");
    assert(emptyResult.submissions.accepted === 0, "1.6 Submissions accepted is 0");
    assert(emptyResult.submissions.acceptanceRate === 0.0, "1.7 Acceptance rate is 0.0");
    assert(emptyResult.submissions.soloSubmissions === 0, "1.8 Solo count is 0");
    assert(emptyResult.submissions.roomSubmissions === 0, "1.9 Room count is 0");
    assert(emptyResult.activity.currentStreak === 0, "1.10 Current streak is 0");
    assert(emptyResult.activity.longestStreak === 0, "1.11 Longest streak is 0");
    assert(Array.isArray(emptyResult.activity.activityByDay) && emptyResult.activity.activityByDay.length === 0, "1.12 activityByDay is empty array");
    assert(emptyResult.performance.averageRuntimeMs === null, "1.13 averageRuntimeMs is null");
    assert(emptyResult.performance.fastestAcceptedRuntimeMs === null, "1.14 fastestAcceptedRuntimeMs is null");
    assert(emptyResult.performance.averageMemoryKb === null, "1.15 averageMemoryKb is null");
    assert(Array.isArray(emptyResult.topics) && emptyResult.topics.length === 0, "1.16 topics is empty array");

    console.log("");

    // =========================================================
    // TEST CASE 2: Active User with Solved Problems & Topics
    // =========================================================
    console.log("--- TEST CASE 2: Solved Problems, Deduplication, & Topics ---");

    const probEasy = await Problem.create({
      title: "Analytics Easy Problem",
      slug: "analytics-prob-easy-1",
      description: "Easy problem description",
      difficulty: "Easy",
      tags: [" Array ", "Array", "Hash Table", "", " "],
      starterCode: { javascript: "", python: "", java: "", cpp: "" },
      execution: { functionName: "solve", parameters: ["a"] },
    });

    const probMed = await Problem.create({
      title: "Analytics Med Problem",
      slug: "analytics-prob-med-1",
      description: "Med problem description",
      difficulty: "Medium",
      tags: ["Array", "Two Pointers"],
      starterCode: { javascript: "", python: "", java: "", cpp: "" },
      execution: { functionName: "solve", parameters: ["a"] },
    });

    const probHard = await Problem.create({
      title: "Analytics Hard Problem",
      slug: "analytics-prob-hard-1",
      description: "Hard problem description",
      difficulty: "Hard",
      tags: ["Dynamic Programming", "Two Pointers"],
      starterCode: { javascript: "", python: "", java: "", cpp: "" },
      execution: { functionName: "solve", parameters: ["a"] },
    });

    // Create user with duplicate probEasy and an orphan ID
    const fakeDeletedId = new mongoose.Types.ObjectId();
    const activeUser = await User.create({
      name: "Active Analytics User",
      email: "analytics_active_user@example.com",
      password: "hashed_password_test_123",
      solvedProblems: [
        { problem: probEasy._id, solvedAt: new Date() },
        { problem: probEasy._id, solvedAt: new Date() }, // Duplicate problem
        { problem: probMed._id, solvedAt: new Date() },
        { problem: probHard._id, solvedAt: new Date() },
        { problem: fakeDeletedId, solvedAt: new Date() }, // Orphan problem
      ],
    });

    const solvedCheck = await getUserAnalytics(activeUser._id);
    assert(solvedCheck.solved.totalSolved === 3, "2.1 totalSolved is exactly 3 (deduplicated & orphan ignored)");
    assert(solvedCheck.solved.easy === 1, "2.2 solved.easy is 1");
    assert(solvedCheck.solved.medium === 1, "2.3 solved.medium is 1");
    assert(solvedCheck.solved.hard === 1, "2.4 solved.hard is 1");

    // Check Topics:
    // probEasy: Array (1), Hash Table (1)
    // probMed: Array (1), Two Pointers (1)
    // probHard: Dynamic Programming (1), Two Pointers (1)
    // Totals: Array (2), Two Pointers (2), Dynamic Programming (1), Hash Table (1)
    // Sorting: Array & Two Pointers tied at 2 -> Array first alphabetically.
    // DP & Hash Table tied at 1 -> DP first alphabetically.
    assert(solvedCheck.topics.length === 4, "2.5 4 unique topics returned");
    assert(solvedCheck.topics[0].tag === "Array" && solvedCheck.topics[0].solvedCount === 2, "2.6 Topic 0 is Array (2)");
    assert(solvedCheck.topics[1].tag === "Two Pointers" && solvedCheck.topics[1].solvedCount === 2, "2.7 Topic 1 is Two Pointers (2)");
    assert(solvedCheck.topics[2].tag === "Dynamic Programming" && solvedCheck.topics[2].solvedCount === 1, "2.8 Topic 2 is Dynamic Programming (1)");
    assert(solvedCheck.topics[3].tag === "Hash Table" && solvedCheck.topics[3].solvedCount === 1, "2.9 Topic 3 is Hash Table (1)");

    console.log("");

    // =========================================================
    // TEST CASE 3: Mixed Submissions, Statuses, Solo/Room & Performance
    // =========================================================
    console.log("--- TEST CASE 3: Submissions, Performance & Status Aggregates ---");

    const fakeRoomId = new mongoose.Types.ObjectId();

    // 1. Accepted (solo) - runtime 30, memory 12000
    await Submission.create({
      user: activeUser._id,
      problem: probEasy._id,
      room: null,
      language: "cpp",
      code: "void test(){}",
      status: "Accepted",
      runtimeMs: 30,
      memoryKb: 12000,
      createdAt: new Date("2026-09-12T10:00:00.000Z"),
    });

    // 2. Accepted (room) - runtime 10 (fastest), memory 8000
    await Submission.create({
      user: activeUser._id,
      problem: probEasy._id,
      room: fakeRoomId,
      language: "cpp",
      code: "void test(){}",
      status: "Accepted",
      runtimeMs: 10,
      memoryKb: 8000,
      createdAt: new Date("2026-09-13T10:00:00.000Z"),
    });

    // 3. Wrong Answer (solo) - runtime 20, memory 10000
    await Submission.create({
      user: activeUser._id,
      problem: probMed._id,
      room: null,
      language: "cpp",
      code: "void test(){}",
      status: "Wrong Answer",
      runtimeMs: 20,
      memoryKb: 10000,
      createdAt: new Date("2026-09-13T12:00:00.000Z"),
    });

    // 4. Time Limit Exceeded (solo) - runtime null, memory null
    await Submission.create({
      user: activeUser._id,
      problem: probMed._id,
      room: null,
      language: "cpp",
      code: "void test(){}",
      status: "Time Limit Exceeded",
      runtimeMs: null,
      memoryKb: null,
      createdAt: new Date("2026-09-14T09:00:00.000Z"),
    });

    // 5. Runtime Error (room) - runtime 0, memory 0 (0 memory is invalid)
    await Submission.create({
      user: activeUser._id,
      problem: probHard._id,
      room: fakeRoomId,
      language: "cpp",
      code: "void test(){}",
      status: "Runtime Error",
      runtimeMs: 0,
      memoryKb: 0,
      createdAt: new Date("2026-09-14T11:00:00.000Z"),
    });

    // 6. Compilation Error (solo) - runtime null, memory null
    await Submission.create({
      user: activeUser._id,
      problem: probHard._id,
      room: null,
      language: "cpp",
      code: "void test(){}",
      status: "Compilation Error",
      runtimeMs: null,
      memoryKb: null,
      createdAt: new Date("2026-09-14T14:00:00.000Z"),
    });

    // 7. Unexpected Status (solo) - should not crash
    await Submission.create({
      user: activeUser._id,
      problem: probHard._id,
      room: null,
      language: "cpp",
      code: "void test(){}",
      status: "Pending",
      runtimeMs: -1, // invalid negative
      memoryKb: null,
      createdAt: new Date("2026-09-14T15:00:00.000Z"),
    });

    const fixedNow = new Date("2026-09-14T16:00:00.000Z");
    const activeResult = await getUserAnalytics(activeUser._id, fixedNow);

    assert(activeResult.submissions.total === 7, "3.1 Total submissions is 7");
    assert(activeResult.submissions.accepted === 2, "3.2 Accepted count is 2");
    assert(activeResult.submissions.wrongAnswer === 1, "3.3 Wrong Answer count is 1");
    assert(activeResult.submissions.timeLimitExceeded === 1, "3.4 TLE count is 1");
    assert(activeResult.submissions.runtimeError === 1, "3.5 Runtime Error count is 1");
    assert(activeResult.submissions.compilationError === 1, "3.6 Compilation Error count is 1");
    assert(activeResult.submissions.soloSubmissions === 5, "3.7 Solo submissions count is 5");
    assert(activeResult.submissions.roomSubmissions === 2, "3.8 Room submissions count is 2");

    // Acceptance rate: 2 / 7 * 100 = 28.5714... -> 28.6
    assert(activeResult.submissions.acceptanceRate === 28.6, "3.9 Acceptance rate is exactly 28.6");

    // Valid runtimes: 30, 10, 20, 0 -> sum = 60 / 4 = 15.0
    assert(activeResult.performance.averageRuntimeMs === 15.0, "3.10 averageRuntimeMs is 15.0");
    assert(activeResult.performance.fastestAcceptedRuntimeMs === 10, "3.11 fastestAcceptedRuntimeMs is 10");

    // Valid memory: 12000, 8000, 10000 -> sum = 30000 / 3 = 10000.0
    assert(activeResult.performance.averageMemoryKb === 10000.0, "3.12 averageMemoryKb is 10000.0");

    // Activity:
    // 2026-09-12: 1 submission
    // 2026-09-13: 2 submissions
    // 2026-09-14: 4 submissions
    assert(activeResult.activity.activityByDay.length === 3, "3.13 activityByDay has 3 active dates");
    assert(activeResult.activity.activityByDay[0].date === "2026-09-12" && activeResult.activity.activityByDay[0].submissions === 1, "3.14 Day 1 count is 1");
    assert(activeResult.activity.activityByDay[1].date === "2026-09-13" && activeResult.activity.activityByDay[1].submissions === 2, "3.15 Day 2 count is 2");
    assert(activeResult.activity.activityByDay[2].date === "2026-09-14" && activeResult.activity.activityByDay[2].submissions === 4, "3.16 Day 3 count is 4");
    assert(activeResult.activity.currentStreak === 3, "3.17 currentStreak is 3 (12, 13, 14)");
    assert(activeResult.activity.longestStreak === 3, "3.18 longestStreak is 3");

    console.log("");

    // =========================================================
    // TEST CASE 4: Privacy & Security Constraint Validation
    // =========================================================
    console.log("--- TEST CASE 4: Privacy Guarantee Verification ---");

    assert(activeResult.code === undefined, "4.1 No 'code' field exposed at root");
    assert(activeResult.testResults === undefined, "4.2 No 'testResults' exposed");
    assert(activeResult.failedTestCase === undefined, "4.3 No 'failedTestCase' exposed");
    assert(activeResult.input === undefined && activeResult.expectedOutput === undefined, "4.4 No raw test I/O exposed");
    assert(activeResult.submissions.items === undefined, "4.5 No raw submission documents exposed");
    assert(activeResult.password === undefined, "4.6 No password hash exposed");

    console.log("\n=================================================");
    console.log(`🎉 ALL ${passedCount} ANALYTICS SERVICE TESTS PASSED!`);
    console.log("=================================================\n");
  } finally {
    await cleanupTestData(testEmails, testProblemSlugs);
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("\n❌ TEST SUITE FAILED WITH UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});
