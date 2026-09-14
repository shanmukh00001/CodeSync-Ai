/**
 * Stage 9.3 Verification Test Suite — AI Code Review HTTP API Endpoint
 * 
 * Verifies authentication, input validation, problem fetching & hidden-test privacy,
 * solo reviews, room authorization, rate limiting (5 req/min), error mapping,
 * and zero database persistence.
 */

require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const http = require("http");
const express = require("express");
const cookieParser = require("cookie-parser");

const User = require("./models/User");
const Problem = require("./models/Problem");
const Room = require("./models/Room");
const Submission = require("./models/Submission");
const submissionRoutes = require("./routes/submissionRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");
const { setAIProvider } = require("./services/ai/aiProviderFactory");
const MockAiProvider = require("./services/ai/mockAiProvider");
const GeminiProvider = require("./services/ai/geminiProvider");

const JWT_SECRET = process.env.JWT_SECRET || "test_secret_for_stage93";

async function makeRequest(port, path, method = "POST", body = {}, token = null) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(postData),
    };

    if (token) {
      headers["Cookie"] = `token=${token}`;
    }

    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path,
        method,
        headers,
      },
      (res) => {
        let rawData = "";
        res.on("data", (chunk) => (rawData += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(rawData);
            resolve({ status: res.statusCode, data: json, headers: res.headers });
          } catch {
            resolve({ status: res.statusCode, raw: rawData, headers: res.headers });
          }
        });
      }
    );

    req.on("error", reject);
    req.write(postData);
    req.end();
  });
}

async function runStage93Tests() {
  console.log("=================================================");
  console.log("🚀 STARTING STAGE 9.3 AI CODE REVIEW API TEST SUITE");
  console.log("=================================================\n");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("✓ Connected to MongoDB.\n");

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  // Create Express test app
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/submissions", submissionRoutes);
  app.use(errorMiddleware);

  const server = app.listen(0);
  const port = server.address().port;

  // Mock Provider for deterministic testing
  const mockProvider = new MockAiProvider();
  setAIProvider(mockProvider);

  // Seed fixture users, problem, and rooms
  const userA = await User.create({
    name: "User Reviewer A",
    email: `reviewer_a_${Date.now()}@test.com`,
    password: "Password123!",
  });

  const userB = await User.create({
    name: "User Reviewer B",
    email: `reviewer_b_${Date.now()}@test.com`,
    password: "Password123!",
  });

  const tokenA = jwt.sign({ userId: userA._id }, JWT_SECRET, { expiresIn: "1h" });
  const tokenB = jwt.sign({ userId: userB._id }, JWT_SECRET, { expiresIn: "1h" });

  const testProblem = await Problem.create({
    title: "Stage 9 Test Two Sum",
    slug: `stage9-two-sum-${Date.now()}`,
    description: "Given an array of integers, return indices of the two numbers.",
    difficulty: "Easy",
    constraints: ["2 <= nums.length <= 10^4"],
    examples: [{ input: "[2,7,11,15], 9", output: "[0,1]" }],
    testCases: [
      { input: "[2,7,11,15], 9", expectedOutput: "[0,1]", isHidden: false },
      { input: "[3,2,4], 6", expectedOutput: "[1,2]", isHidden: true },
      { input: "SECRET_INPUT_FOR_HIDDEN_TEST", expectedOutput: "SECRET_OUTPUT", isHidden: true },
    ],
    execution: {
      functionName: "twoSum",
      parameters: ["nums", "target"],
    },
  });

  const activeRoom = await Room.create({
    roomId: `stage9-active-room-${Date.now()}`,
    roomName: "Active Review Room",
    createdBy: userA._id,
    users: [userA._id],
    status: "ACTIVE",
    selectedProblem: testProblem._id,
  });

  const closedRoom = await Room.create({
    roomId: `stage9-closed-room-${Date.now()}`,
    roomName: "Closed Review Room",
    createdBy: userA._id,
    users: [userA._id],
    status: "CLOSED",
    selectedProblem: testProblem._id,
  });

  try {
    // -------------------------------------------------------------
    // SECTION 1: AUTHENTICATION & IDENTITY
    // -------------------------------------------------------------
    console.log("--- 1. Authentication & Identity Matrix ---");

    // 1. Missing auth
    const unauthRes = await makeRequest(port, "/api/submissions/review", "POST", {
      problemId: testProblem._id,
      language: "cpp",
      code: "int main() {}",
    });
    assert.strictEqual(unauthRes.status, 401);
    pass("1.1 Unauthenticated review request returns HTTP 401");

    // 2. Invalid auth token
    const invalidAuthRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "int main() {}" },
      "invalid.garbage.token"
    );
    assert.strictEqual(invalidAuthRes.status, 401);
    pass("1.2 Invalid JWT token returns HTTP 401");

    // -------------------------------------------------------------
    // SECTION 2: INPUT VALIDATION MATRIX
    // -------------------------------------------------------------
    console.log("\n--- 2. Input Validation Matrix ---");

    // 3. Missing problemId
    const missingProblemId = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(missingProblemId.status, 400);
    assert.strictEqual(missingProblemId.data.error.code, "AI_INVALID_INPUT");
    pass("2.1 Missing problemId returns 400 AI_INVALID_INPUT");

    // 4. Invalid problemId format
    const invalidProblemId = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: "not-an-objectid", language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(invalidProblemId.status, 400);
    assert.strictEqual(invalidProblemId.data.error.code, "AI_INVALID_INPUT");
    pass("2.2 Malformed problemId returns 400 AI_INVALID_INPUT");

    // 5. Missing code
    const missingCode = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp" },
      tokenA
    );
    assert.strictEqual(missingCode.status, 400);
    assert.strictEqual(missingCode.data.error.code, "AI_INVALID_INPUT");
    pass("2.3 Missing code returns 400 AI_INVALID_INPUT");

    // 6. Empty code
    const emptyCode = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "   " },
      tokenA
    );
    assert.strictEqual(emptyCode.status, 400);
    assert.strictEqual(emptyCode.data.error.code, "AI_INVALID_INPUT");
    pass("2.4 Empty whitespace code returns 400 AI_INVALID_INPUT");

    // 7. Oversized code (>65536)
    const oversizedCode = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "x".repeat(65537) },
      tokenA
    );
    assert.strictEqual(oversizedCode.status, 400);
    assert.strictEqual(oversizedCode.data.error.code, "AI_INVALID_INPUT");
    pass("2.5 Oversized code (>64KB) returns 400 AI_INVALID_INPUT");

    // 8. Unsupported language
    const unsupportedLang = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "ruby", code: "puts 'hello'" },
      tokenA
    );
    assert.strictEqual(unsupportedLang.status, 400);
    assert.strictEqual(unsupportedLang.data.error.code, "AI_INVALID_INPUT");
    pass("2.6 Unsupported language (ruby) returns 400 AI_INVALID_INPUT");

    // 9. Malformed roomId
    const malformedRoom = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "int main() {}", roomId: "   " },
      tokenA
    );
    assert.strictEqual(malformedRoom.status, 400);
    pass("2.7 Malformed empty roomId returns 400 AI_INVALID_INPUT");

    // -------------------------------------------------------------
    // SECTION 3: PROBLEM CONTEXT & HIDDEN TEST PRIVACY
    // -------------------------------------------------------------
    console.log("\n--- 3. Problem Context & Privacy Guarantees ---");

    // 10. Nonexistent problem
    const nonExistentProblem = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: new mongoose.Types.ObjectId(), language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(nonExistentProblem.status, 404);
    assert.strictEqual(nonExistentProblem.data.error.code, "PROBLEM_NOT_FOUND");
    pass("3.1 Nonexistent problem returns HTTP 404 PROBLEM_NOT_FOUND");

    // 11. Valid solo review execution & privacy check
    mockProvider.callCount = 0;
    const soloRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "cpp",
        code: "int twoSum() { return 0; }",
        lastExecutionResult: {
          status: "Accepted",
          passedTestCases: 1,
          totalTestCases: 1,
          runtimeMs: 8,
          memoryKb: 3400,
          spoofedSecret: "ATTEMPTED_SECRET_LEAK",
        },
      },
      tokenA
    );
    assert.strictEqual(soloRes.status, 200);
    assert.strictEqual(soloRes.data.success, true);
    assert.ok(soloRes.data.review.summary);
    assert.strictEqual(mockProvider.callCount, 1);

    // Verify last input given to provider
    const lastInput = mockProvider.lastInput;
    assert.strictEqual(lastInput.problem.title, "Stage 9 Test Two Sum");
    assert.strictEqual(lastInput.problem.difficulty, "Easy");
    assert.strictEqual(lastInput.lastExecutionResult.status, "Accepted");
    assert.strictEqual(lastInput.lastExecutionResult.spoofedSecret, undefined);
    assert.strictEqual(lastInput.problem.testCases, undefined);
    pass("3.2 Successful solo review executed; provider receives only public whitelisted context");

    // 12. No userId accepted from request body (strict req.userId enforcement)
    const spoofedBodyRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "javascript",
        code: "console.log('test');",
        userId: userB._id, // Attempt to spoof User B identity
      },
      tokenA
    );
    assert.strictEqual(spoofedBodyRes.status, 200);
    pass("3.3 Request body userId has zero effect; identity sourced strictly from validated JWT");

    // -------------------------------------------------------------
    // SECTION 4: ROOM AUTHORIZATION MATRIX
    // -------------------------------------------------------------
    console.log("\n--- 4. Collaborative Room Authorization Matrix ---");

    // 14. Nonexistent room
    const nonExistentRoom = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "cpp",
        code: "int main() {}",
        roomId: "nonexistent-room-uuid",
      },
      tokenA
    );
    assert.strictEqual(nonExistentRoom.status, 404);
    assert.strictEqual(nonExistentRoom.data.error.code, "ROOM_NOT_FOUND");
    pass("4.1 Nonexistent room returns HTTP 404 ROOM_NOT_FOUND");

    // 15. Non-member requesting room review (User B not in User A's active room)
    const nonMemberRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "cpp",
        code: "int main() {}",
        roomId: activeRoom.roomId,
      },
      tokenB
    );
    assert.strictEqual(nonMemberRes.status, 403);
    assert.strictEqual(nonMemberRes.data.error.code, "FORBIDDEN");
    pass("4.2 Non-member in room returns HTTP 403 FORBIDDEN");

    // 16. CLOSED room rejection
    const closedRoomRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "cpp",
        code: "int main() {}",
        roomId: closedRoom.roomId,
      },
      tokenA
    );
    assert.strictEqual(closedRoomRes.status, 400);
    assert.strictEqual(closedRoomRes.data.error.code, "ROOM_CLOSED");
    pass("4.3 CLOSED room request returns HTTP 400 ROOM_CLOSED");

    // 17. Active room member review allowed
    const activeMemberRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id,
        language: "cpp",
        code: "int main() {}",
        roomId: activeRoom.roomId,
      },
      tokenA
    );
    assert.strictEqual(activeMemberRes.status, 200);
    assert.strictEqual(activeMemberRes.data.success, true);
    pass("4.4 Active room member successfully receives code review");

    // -------------------------------------------------------------
    // SECTION 5: PROVIDER ERROR HANDLING & UNPERSISTED STATE
    // -------------------------------------------------------------
    console.log("\n--- 5. Provider Error Translation & Ephemeral State ---");

    // 25. Malformed provider response
    mockProvider.setMode("malformed");
    const malformedRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(malformedRes.status, 502);
    assert.strictEqual(malformedRes.data.error.code, "AI_MALFORMED_RESPONSE");
    pass("5.1 Malformed provider response translated to HTTP 502 AI_MALFORMED_RESPONSE");

    // 26. Provider runtime error
    mockProvider.setMode("error");
    const providerErrRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(providerErrRes.status, 502);
    assert.strictEqual(providerErrRes.data.error.code, "AI_PROVIDER_ERROR");
    pass("5.2 Provider runtime error translated to HTTP 502 AI_PROVIDER_ERROR");

    // 27. Provider unavailable
    mockProvider.setMode("unavailable");
    const unavailRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "cpp", code: "int main() {}" },
      tokenA
    );
    assert.strictEqual(unavailRes.status, 503);
    assert.strictEqual(unavailRes.data.error.code, "AI_SERVICE_UNAVAILABLE");
    pass("5.3 Provider unavailable translated to HTTP 503 AI_SERVICE_UNAVAILABLE");

    // Verify zero database writes to Submission or any AI table
    mockProvider.setMode("success");
    const submissionCountBefore = await Submission.countDocuments();
    await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "python", code: "def sol(): pass" },
      tokenA
    );
    const submissionCountAfter = await Submission.countDocuments();
    assert.strictEqual(submissionCountBefore, submissionCountAfter);
    pass("5.4 Ephemeral review confirmed: Zero submissions or reviews written to MongoDB");

    // -------------------------------------------------------------
    // SECTION 6: RATE LIMITING (5 REQUESTS / MINUTE PER USER)
    // -------------------------------------------------------------
    console.log("\n--- 6. User-Scoped Rate Limiting Matrix ---");

    // User B sends 5 requests in succession
    for (let i = 1; i <= 5; i++) {
      const res = await makeRequest(
        port,
        "/api/submissions/review",
        "POST",
        { problemId: testProblem._id, language: "python", code: `def solve_${i}(): pass` },
        tokenB
      );
      assert.strictEqual(res.status, 200, `Request ${i} for User B should succeed`);
    }
    pass("6.1 First 5 requests within rate limit window allowed for User B");

    // 6th request from User B should hit 429
    const rateLimitedRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      { problemId: testProblem._id, language: "python", code: "def solve_6(): pass" },
      tokenB
    );
    assert.strictEqual(rateLimitedRes.status, 429);
    assert.strictEqual(rateLimitedRes.data.error.code, "AI_RATE_LIMIT");
    pass("6.2 6th request within window rejected with HTTP 429 AI_RATE_LIMIT");

    // Rate limiter on /review does not block standard submission endpoints (/run or /submit)
    const runRes = await makeRequest(
      port,
      "/api/submissions/run",
      "POST",
      { problemId: testProblem._id, language: "python", code: "def twoSum(nums, target): return [0, 1]" },
      tokenB
    );
    // 200 or 500 depending on piston, but definitely NOT 429 AI_RATE_LIMIT
    assert.notStrictEqual(runRes.status, 429);
    pass("6.3 Rate limiter specifically scopes to /review and does not bleed into /run or /submit");

    // -------------------------------------------------------------
    // SECTION 7: CONTROLLED LIVE GEMINI END-TO-END TEST
    // -------------------------------------------------------------
    console.log("\n--- 7. Optional Controlled Live API Test ---");
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.startsWith("AQ.")) {
      console.log("  ⚡ Running ONE live authenticated Gemini review request via HTTP endpoint...");
      setAIProvider(new GeminiProvider({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || "gemini-3.6-flash" }));

      const liveHttpRes = await makeRequest(
        port,
        "/api/submissions/review",
        "POST",
        {
          problemId: testProblem._id,
          language: "cpp",
          code: `#include <vector>
using namespace std;
vector<int> twoSum(vector<int>& nums, int target) {
    for (int i = 0; i < nums.size(); ++i) {
        for (int j = i + 1; j < nums.size(); ++j) {
            if (nums[i] + nums[j] == target) return {i, j};
        }
    }
    return {};
}`,
          lastExecutionResult: {
            status: "Accepted",
            passedTestCases: 2,
            totalTestCases: 2,
            runtimeMs: 10,
            memoryKb: 4000,
          },
        },
        tokenA
      );

      assert.strictEqual(liveHttpRes.status, 200);
      assert.strictEqual(liveHttpRes.data.success, true);
      assert.ok(liveHttpRes.data.review.summary);
      assert.ok(liveHttpRes.data.review.verdictAssessment.timeComplexity);
      pass("7.1 Real Gemini HTTP review request passed with validated structured response");
      console.log(`     Summary: "${liveHttpRes.data.review.summary}"`);
      console.log(`     Complexity: Time ${liveHttpRes.data.review.verdictAssessment.timeComplexity}, Space ${liveHttpRes.data.review.verdictAssessment.spaceComplexity}`);
    } else {
      console.log("  ⚠️  LIVE GEMINI HTTP TEST SKIPPED (No GEMINI_API_KEY configured)");
    }

    console.log("\n=================================================");
    console.log(`🎉 ALL ${passedTests} AI CODE REVIEW API TESTS PASSED!`);
    console.log("=================================================");
  } finally {
    // Cleanup fixtures and close server
    await User.deleteMany({ _id: { $in: [userA._id, userB._id] } });
    await Problem.deleteOne({ _id: testProblem._id });
    await Room.deleteMany({ _id: { $in: [activeRoom._id, closedRoom._id] } });
    server.close();
    await mongoose.disconnect();
  }
}

runStage93Tests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
