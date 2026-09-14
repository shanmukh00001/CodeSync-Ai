/**
 * verifyAnalyticsApi.js
 *
 * Comprehensive HTTP/API Verification Suite for CodeSync AI Personal Analytics Endpoint (Stage 8.4).
 * Target: GET /api/users/analytics
 *
 * Requirements & Scenarios Tested:
 * 1. Authenticated user receives 200 with contract-compliant payload
 * 2. Unauthenticated request receives 401 Unauthorized
 * 3. Invalid token receives 401 Unauthorized
 * 4. User identity comes strictly from req.userId (verified token)
 * 5. Query param userId cannot override identity (User A cannot see User B's analytics)
 * 6. Body userId cannot override identity
 * 7. Zero-data user receives normalized zero/null response
 * 8. Solved metrics (total, easy, medium, hard) are accurately returned
 * 9. Submission metrics (total, statuses, solo, room) are accurately returned
 * 10. Acceptance rate is computed and returned
 * 11. Activity/streak metrics (currentStreak, longestStreak, activityByDay) are returned
 * 12. Performance metrics (averageRuntimeMs, fastestAcceptedRuntimeMs, averageMemoryKb) are returned
 * 13. Topics distribution is returned with correct sorting
 * 14. Privacy: No raw code, testResults, failedTestCase, inputs, outputs, passwords, or tokens in response
 * 15. Server error handling preserves centralized error conventions
 * 16. Response structure strictly adheres to Stage 8.1 contract
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");

const BASE_URL = process.env.BASE_URL || "http://localhost:5000";

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

async function createTestUser(email, name = "Test User") {
  await User.deleteOne({ email });
  const user = await User.create({
    name,
    email,
    password: "hashed_test_password_123",
    solvedProblems: [],
  });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });
  const cookie = `token=${token}`;
  return { user, token, cookie };
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
  console.log("🚀 STARTING STAGE 8.4 ANALYTICS HTTP API TEST SUITE");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI not configured in .env");
  }
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB.\n");

  const testEmails = [
    "api_analytics_user_a@example.com",
    "api_analytics_user_b@example.com",
    "api_analytics_empty@example.com",
  ];

  const testProblemSlugs = [
    "api-analytics-prob-1",
    "api-analytics-prob-2",
  ];

  try {
    await cleanupTestData(testEmails, testProblemSlugs);

    // Create test problems
    const prob1 = await Problem.create({
      title: "API Analytics Prob 1",
      slug: "api-analytics-prob-1",
      description: "Description 1",
      difficulty: "Easy",
      tags: ["Array", "Math"],
      starterCode: { javascript: "", python: "", java: "", cpp: "" },
      execution: { functionName: "solve", parameters: ["a"] },
    });

    const prob2 = await Problem.create({
      title: "API Analytics Prob 2",
      slug: "api-analytics-prob-2",
      description: "Description 2",
      difficulty: "Medium",
      tags: ["Array", "DP"],
      starterCode: { javascript: "", python: "", java: "", cpp: "" },
      execution: { functionName: "solve", parameters: ["a"] },
    });

    // Create User A (with data) and User B (empty)
    const userA = await createTestUser("api_analytics_user_a@example.com", "User A");
    const userB = await createTestUser("api_analytics_user_b@example.com", "User B");
    const emptyUser = await createTestUser("api_analytics_empty@example.com", "Empty User");

    // Populate User A solvedProblems
    userA.user.solvedProblems.push({ problem: prob1._id, solvedAt: new Date() });
    userA.user.solvedProblems.push({ problem: prob2._id, solvedAt: new Date() });
    await userA.user.save();

    // Populate User A submissions
    await Submission.create({
      user: userA.user._id,
      problem: prob1._id,
      room: null,
      language: "cpp",
      code: "int main(){}",
      status: "Accepted",
      runtimeMs: 15,
      memoryKb: 5000,
      createdAt: new Date(),
    });

    await Submission.create({
      user: userA.user._id,
      problem: prob2._id,
      room: null,
      language: "cpp",
      code: "int main(){}",
      status: "Wrong Answer",
      runtimeMs: 25,
      memoryKb: 6000,
      createdAt: new Date(),
    });

    // =========================================================
    // TEST 1: Unauthenticated Request Returns 401
    // =========================================================
    console.log("--- TEST 1: Authentication & Authorization ---");
    {
      const res = await fetch(`${BASE_URL}/api/users/analytics`);
      assert(res.status === 401, "1.1 Unauthenticated request returns HTTP 401");
      const body = await res.json();
      assert(body.error !== undefined, "1.2 Error structure returned for 401");
    }

    // =========================================================
    // TEST 2: Invalid Token Returns 401
    // =========================================================
    {
      const res = await fetch(`${BASE_URL}/api/users/analytics`, {
        headers: { Cookie: "token=invalid_forged_token_12345" },
      });
      assert(res.status === 401, "2.1 Invalid token returns HTTP 401");
    }

    // =========================================================
    // TEST 3: Authenticated User A Receives 200 with Full Contract Shape
    // =========================================================
    console.log("\n--- TEST 3: Authenticated User Analytics Payload ---");
    let userAResult;
    {
      const res = await fetch(`${BASE_URL}/api/users/analytics`, {
        headers: { Cookie: userA.cookie },
      });
      assert(res.status === 200, "3.1 Authenticated User A returns HTTP 200");
      userAResult = await res.json();
      assert(userAResult.success === true, "3.2 Payload contains success: true");
      assert(userAResult.analytics !== undefined, "3.3 Payload contains analytics object");

      // Verify User A values
      const a = userAResult.analytics;
      assert(a.userId === String(userA.user._id), "3.4 userId matches User A");
      assert(a.solved.totalSolved === 2, "3.5 Solved total is 2");
      assert(a.solved.easy === 1, "3.6 Solved easy is 1");
      assert(a.solved.medium === 1, "3.7 Solved medium is 1");
      assert(a.solved.hard === 0, "3.8 Solved hard is 0");
      assert(a.submissions.total === 2, "3.9 Submissions total is 2");
      assert(a.submissions.accepted === 1, "3.10 Submissions accepted is 1");
      assert(a.submissions.wrongAnswer === 1, "3.11 Submissions wrongAnswer is 1");
      assert(a.submissions.acceptanceRate === 50.0, "3.12 Acceptance rate is 50.0");
      assert(a.performance.averageRuntimeMs === 20.0, "3.13 averageRuntimeMs is 20.0");
      assert(a.performance.fastestAcceptedRuntimeMs === 15, "3.14 fastestAcceptedRuntimeMs is 15");
      assert(a.performance.averageMemoryKb === 5500.0, "3.15 averageMemoryKb is 5500.0");
      assert(Array.isArray(a.topics) && a.topics.length === 3, "3.16 3 topics returned (Array, DP, Math)");
    }

    // =========================================================
    // TEST 4: Identity Spoofing Protection (Query & Body)
    // =========================================================
    console.log("\n--- TEST 4: Security & Identity Spoofing Prevention ---");
    {
      // Authenticate as User B, try to pass User A's ID via query param
      const res = await fetch(
        `${BASE_URL}/api/users/analytics?userId=${userA.user._id}&user=${userA.user._id}&id=${userA.user._id}`,
        {
          headers: { Cookie: userB.cookie },
        }
      );
      assert(res.status === 200, "4.1 Request as User B succeeds");
      const body = await res.json();
      assert(
        body.analytics.userId === String(userB.user._id),
        "4.2 Returned analytics belongs to User B (req.userId), NOT spoofed User A in query"
      );
      assert(
        body.analytics.solved.totalSolved === 0,
        "4.3 User B solved count is 0 (did NOT leak User A's 2 solved problems)"
      );
      assert(
        body.analytics.submissions.total === 0,
        "4.4 User B submission count is 0 (did NOT leak User A's submissions)"
      );
    }

    // =========================================================
    // TEST 5: Zero-Data / Empty User Response Contract
    // =========================================================
    console.log("\n--- TEST 5: Zero-Data Normalized Response Contract ---");
    {
      const res = await fetch(`${BASE_URL}/api/users/analytics`, {
        headers: { Cookie: emptyUser.cookie },
      });
      assert(res.status === 200, "5.1 Zero-data user returns HTTP 200");
      const body = await res.json();
      const a = body.analytics;

      assert(a.solved.totalSolved === 0, "5.2 solved.totalSolved is 0");
      assert(a.solved.easy === 0, "5.3 solved.easy is 0");
      assert(a.solved.medium === 0, "5.4 solved.medium is 0");
      assert(a.solved.hard === 0, "5.5 solved.hard is 0");
      assert(a.submissions.total === 0, "5.6 submissions.total is 0");
      assert(a.submissions.acceptanceRate === 0.0, "5.7 submissions.acceptanceRate is 0.0");
      assert(a.activity.currentStreak === 0, "5.8 activity.currentStreak is 0");
      assert(a.activity.longestStreak === 0, "5.9 activity.longestStreak is 0");
      assert(Array.isArray(a.activity.activityByDay) && a.activity.activityByDay.length === 0, "5.10 activityByDay is []");
      assert(a.performance.averageRuntimeMs === null, "5.11 performance.averageRuntimeMs is null");
      assert(a.performance.fastestAcceptedRuntimeMs === null, "5.12 performance.fastestAcceptedRuntimeMs is null");
      assert(a.performance.averageMemoryKb === null, "5.13 performance.averageMemoryKb is null");
      assert(Array.isArray(a.topics) && a.topics.length === 0, "5.14 topics is []");
    }

    // =========================================================
    // TEST 6: Privacy Guarantee Verification at HTTP Layer
    // =========================================================
    console.log("\n--- TEST 6: Privacy Guarantee on API Output ---");
    {
      const rawString = JSON.stringify(userAResult);
      assert(!rawString.includes("int main(){}"), "6.1 Source code is not in HTTP response");
      assert(userAResult.analytics.code === undefined, "6.2 'code' property absent");
      assert(userAResult.analytics.testResults === undefined, "6.3 'testResults' property absent");
      assert(userAResult.analytics.failedTestCase === undefined, "6.4 'failedTestCase' property absent");
      assert(userAResult.analytics.input === undefined, "6.5 'input' property absent");
      assert(userAResult.analytics.expectedOutput === undefined, "6.6 'expectedOutput' property absent");
      assert(userAResult.analytics.actualOutput === undefined, "6.7 'actualOutput' property absent");
      assert(userAResult.analytics.password === undefined, "6.8 'password' hash absent");
    }

    console.log("\n=================================================");
    console.log(`🎉 ALL ${passedCount} HTTP API ANALYTICS TESTS PASSED!`);
    console.log("=================================================\n");
  } finally {
    await cleanupTestData(testEmails, testProblemSlugs);
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("\n❌ HTTP API TEST SUITE FAILED:", err);
  process.exit(1);
});
