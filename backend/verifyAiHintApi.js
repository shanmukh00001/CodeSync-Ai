/**
 * Stage 10.3 Verification Test Suite — AI Hint HTTP API Endpoint (POST /api/submissions/hint)
 * 
 * Verifies authentication, input validation, public problem context projection,
 * solo hints, collaborative room authorization, CLOSED room rejection,
 * user-scoped rate limiting (6 req/min), error mapping, zero database persistence,
 * and Stage 9 AI Review backward compatibility.
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

const JWT_SECRET = process.env.JWT_SECRET || "test_secret_for_stage103";

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

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING STAGE 10.3 AI HINT HTTP API TESTS");
  console.log("=================================================\n");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codesync_test_stage103";
  await mongoose.connect(mongoUri);
  console.log("✓ Connected to MongoDB for API testing.");

  // Spin up dedicated test Express instance
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/submissions", submissionRoutes);
  app.use(errorMiddleware);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  // Set up mock AI provider
  const mockProvider = new MockAiProvider();
  setAIProvider(mockProvider);

  let testUserA, testUserB, tokenA, tokenB, testProblem, activeRoom, closedRoom;

  try {
    // -------------------------------------------------------------
    // SETUP TEST FIXTURES
    // -------------------------------------------------------------
    testUserA = await User.create({
      name: "Hint Dev A",
      email: `hint_user_a_${Date.now()}@codesync.dev`,
      password: "hashedpassword123",
    });
    tokenA = jwt.sign({ userId: testUserA._id }, JWT_SECRET, { expiresIn: "1h" });

    testUserB = await User.create({
      name: "Hint Dev B",
      email: `hint_user_b_${Date.now()}@codesync.dev`,
      password: "hashedpassword123",
    });
    tokenB = jwt.sign({ userId: testUserB._id }, JWT_SECRET, { expiresIn: "1h" });

    testProblem = await Problem.create({
      title: "Contains Duplicate",
      slug: `contains-duplicate-${Date.now()}`,
      description: "Given an integer array nums, return true if any value appears at least twice.",
      difficulty: "Easy",
      tags: ["Array", "Hash Table"],
      constraints: ["1 <= nums.length <= 10^5"],
      examples: [{ input: "[1,2,3,1]", output: "true" }],
      starterCode: { cpp: "bool containsDuplicate(vector<int>& nums) {}" },
      execution: { functionName: "containsDuplicate", parameters: ["nums"] },
      testCases: [
        { input: "[1,2,3,1]", expectedOutput: "true", isHidden: false },
        { input: "[1,2,3,4,5,6,1]", expectedOutput: "true", isHidden: true },
        { input: "[1,2,3,4]", expectedOutput: "false", isHidden: true },
      ],
    });

    activeRoom = await Room.create({
      roomId: `room-hint-active-${Date.now()}`,
      roomName: "Active Hint Room",
      language: "cpp",
      createdBy: testUserA._id,
      users: [testUserA._id],
      selectedProblem: testProblem._id,
      status: "ACTIVE",
    });

    closedRoom = await Room.create({
      roomId: `room-hint-closed-${Date.now()}`,
      roomName: "Closed Hint Room",
      language: "cpp",
      createdBy: testUserA._id,
      users: [testUserA._id],
      selectedProblem: testProblem._id,
      status: "CLOSED",
    });

    // -------------------------------------------------------------
    // 1. AUTHENTICATION & SECURITY
    // -------------------------------------------------------------
    console.log("--- 1. Authentication & Security Guardrails ---");

    // 1.1 Unauthenticated request returns 401
    const unauthRes = await makeRequest(port, "/api/submissions/hint", "POST", {
      problemId: testProblem._id.toString(),
      language: "cpp",
      code: "bool containsDuplicate() {}",
    });
    assert.strictEqual(unauthRes.status, 401);
    pass("1.1 Unauthenticated request rejected with HTTP 401");

    // 1.2 Invalid token returns 401
    const invalidTokenRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
      "invalid.garbage.jwt"
    );
    assert.strictEqual(invalidTokenRes.status, 401);
    pass("1.2 Invalid token rejected with HTTP 401");

    // -------------------------------------------------------------
    // 2. INPUT VALIDATION MATRIX
    // -------------------------------------------------------------
    console.log("\n--- 2. Input Validation Matrix ---");

    // 2.1 Missing problemId returns 400
    const missingProbRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { language: "cpp", code: "code" },
      tokenA
    );
    assert.strictEqual(missingProbRes.status, 400);
    assert.strictEqual(missingProbRes.data.error.code, "AI_INVALID_INPUT");
    pass("2.1 Missing problemId returns HTTP 400 AI_INVALID_INPUT");

    // 2.2 Malformed problemId format returns 400
    const malformedProbRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: "not-a-valid-hex-id", language: "cpp", code: "code" },
      tokenA
    );
    assert.strictEqual(malformedProbRes.status, 400);
    pass("2.2 Malformed problemId format returns HTTP 400 AI_INVALID_INPUT");

    // 2.3 Missing code returns 400
    const missingCodeRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp" },
      tokenA
    );
    assert.strictEqual(missingCodeRes.status, 400);
    pass("2.3 Missing code field returns HTTP 400 AI_INVALID_INPUT");

    // 2.4 Oversized code (> 65536 chars) returns 400
    const oversizedCodeRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "x".repeat(65537),
      },
      tokenA
    );
    assert.strictEqual(oversizedCodeRes.status, 400);
    pass("2.4 Oversized code (> 65536 chars) returns HTTP 400 AI_INVALID_INPUT");

    // 2.5 Unsupported language returns 400
    const unsuppLangRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "kotlin",
        code: "fun solve() {}",
      },
      tokenA
    );
    assert.strictEqual(unsuppLangRes.status, 400);
    pass("2.5 Unsupported language (kotlin) returns HTTP 400 AI_INVALID_INPUT");

    // 2.6 Nonexistent problem returns 404
    const nonExistentProbRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: new mongoose.Types.ObjectId().toString(),
        language: "cpp",
        code: "test",
      },
      tokenA
    );
    assert.strictEqual(nonExistentProbRes.status, 404);
    assert.strictEqual(nonExistentProbRes.data.error.code, "PROBLEM_NOT_FOUND");
    pass("2.6 Nonexistent problem returns HTTP 404 PROBLEM_NOT_FOUND");

    // -------------------------------------------------------------
    // 3. PRIVACY BOUNDARIES & SANITIZATION
    // -------------------------------------------------------------
    console.log("\n--- 3. Privacy Boundaries & Sanitization ---");

    // 3.1 Valid solo hint request succeeds and sanitizes payload
    mockProvider.lastInput = null;
    const soloRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "bool containsDuplicate(vector<int>& nums) { return false; }",
        lastExecutionResult: {
          status: "wrong_answer",
          passedTestCases: 1,
          totalTestCases: 3,
          hiddenFixtureData: "LEAK_ATTEMPT",
        },
        userId: testUserB._id.toString(), // Body spoof attempt
      },
      tokenA
    );

    assert.strictEqual(soloRes.status, 200);
    assert.strictEqual(soloRes.data.success, true);
    assert.strictEqual(typeof soloRes.data.hint.concept, "string");
    assert.strictEqual(typeof soloRes.data.hint.suggestedStep, "string");

    // Verify what provider actually received
    assert.strictEqual(mockProvider.lastInput.problem.title, "Contains Duplicate");
    assert.strictEqual(mockProvider.lastInput.problem.testCases, undefined, "Hidden testCases must never reach provider");
    assert.strictEqual(mockProvider.lastInput.lastExecutionResult.hiddenFixtureData, undefined, "Hidden fixture stripped");
    assert.strictEqual(mockProvider.lastInput.userId, undefined, "Untrusted body userId must never reach provider");
    pass("3.1 Valid solo hint executed; hidden tests and body spoofing strictly excluded from provider");

    // -------------------------------------------------------------
    // 4. COLLABORATIVE ROOM AUTHORIZATION & LIFECYCLE
    // -------------------------------------------------------------
    console.log("\n--- 4. Collaborative Room Authorization ---");

    // 4.1 Nonexistent room returns 404
    const nonExistentRoomRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "test",
        roomId: "room-does-not-exist",
      },
      tokenA
    );
    assert.strictEqual(nonExistentRoomRes.status, 404);
    assert.strictEqual(nonExistentRoomRes.data.error.code, "ROOM_NOT_FOUND");
    pass("4.1 Nonexistent roomId returns HTTP 404 ROOM_NOT_FOUND");

    // 4.2 Non-member user requesting hint in room returns 403
    const nonMemberRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "test",
        roomId: activeRoom.roomId,
      },
      tokenB // User B is not in activeRoom
    );
    assert.strictEqual(nonMemberRes.status, 403);
    assert.strictEqual(nonMemberRes.data.error.code, "FORBIDDEN");
    pass("4.2 Non-member in room returns HTTP 403 FORBIDDEN");

    // 4.3 Closed room returns 400 ROOM_CLOSED
    const closedRoomRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "test",
        roomId: closedRoom.roomId,
      },
      tokenA // User A is in closedRoom
    );
    assert.strictEqual(closedRoomRes.status, 400);
    assert.strictEqual(closedRoomRes.data.error.code, "ROOM_CLOSED");
    pass("4.3 CLOSED room hint request rejected with HTTP 400 ROOM_CLOSED");

    // 4.4 Active room member receives hint successfully
    const activeRoomRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "bool containsDuplicate(vector<int>& nums) {}",
        roomId: activeRoom.roomId,
      },
      tokenA
    );
    assert.strictEqual(activeRoomRes.status, 200);
    assert.strictEqual(activeRoomRes.data.success, true);
    pass("4.4 Active room participant receives hint successfully");

    // -------------------------------------------------------------
    // 5. PROVIDER ERROR TRANSLATION & ZERO PERSISTENCE
    // -------------------------------------------------------------
    console.log("\n--- 5. Provider Error Translation & Zero Persistence ---");

    // 5.1 Provider unavailable -> 503
    mockProvider.setMode("unavailable");
    const unavailRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
      tokenA
    );
    assert.strictEqual(unavailRes.status, 503);
    assert.strictEqual(unavailRes.data.error.code, "AI_SERVICE_UNAVAILABLE");
    pass("5.1 Provider unavailable translated to HTTP 503 AI_SERVICE_UNAVAILABLE");

    // 5.2 Provider malformed -> 502
    mockProvider.setMode("malformed");
    const malformedRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
      tokenA
    );
    assert.strictEqual(malformedRes.status, 502);
    assert.strictEqual(malformedRes.data.error.code, "AI_MALFORMED_RESPONSE");
    pass("5.2 Provider malformed output translated to HTTP 502 AI_MALFORMED_RESPONSE");

    // 5.3 Provider error -> 502
    mockProvider.setMode("error");
    const providerErrRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
      tokenA
    );
    assert.strictEqual(providerErrRes.status, 502);
    assert.strictEqual(providerErrRes.data.error.code, "AI_PROVIDER_ERROR");
    pass("5.3 Provider runtime exception translated to HTTP 502 AI_PROVIDER_ERROR");
    mockProvider.setMode("success");

    // 5.4 Zero persistence guarantee: verify no Submissions written
    const dbSubmissions = await Submission.find({ user: testUserA._id });
    assert.strictEqual(dbSubmissions.length, 0, "Zero submissions must be written to MongoDB");
    pass("5.4 Ephemeral hint confirmed: zero database records created");

    // -------------------------------------------------------------
    // 6. USER-SCOPED RATE LIMITING MATRIX
    // -------------------------------------------------------------
    console.log("\n--- 6. User-Scoped Rate Limiting (3 req/min) ---");

    // User B sends 3 requests (limit is 3)
    for (let i = 1; i <= 3; i++) {
      const res = await makeRequest(
        port,
        "/api/submissions/hint",
        "POST",
        { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
        tokenB
      );
      assert.strictEqual(res.status, 200, `Request ${i} should succeed`);
    }
    pass("6.1 First 3 requests within window allowed for User B");

    // 4th request exceeds rate limit -> 429
    const rateLimitRes = await makeRequest(
      port,
      "/api/submissions/hint",
      "POST",
      { problemId: testProblem._id.toString(), language: "cpp", code: "test" },
      tokenB
    );
    assert.strictEqual(rateLimitRes.status, 429);
    assert.strictEqual(rateLimitRes.data.error.code, "AI_RATE_LIMIT");
    pass("6.2 4th request within window rejected with HTTP 429 AI_RATE_LIMIT");

    // -------------------------------------------------------------
    // 7. STAGE 9 AI REVIEW BACKWARD COMPATIBILITY
    // -------------------------------------------------------------
    console.log("\n--- 7. Stage 9 AI Review Backward Compatibility ---");

    const reviewRes = await makeRequest(
      port,
      "/api/submissions/review",
      "POST",
      {
        problemId: testProblem._id.toString(),
        language: "cpp",
        code: "bool containsDuplicate() { return false; }",
      },
      tokenA
    );
    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewRes.data.success, true);
    assert.strictEqual(typeof reviewRes.data.review.summary, "string");
    pass("7.1 POST /api/submissions/review continues operating without interference");

    console.log(`\n=================================================`);
    console.log(`🎉 ALL ${passedTests} STAGE 10.3 API TESTS PASSED!`);
    console.log(`=================================================\n`);
  } finally {
    // Cleanup fixtures
    if (testUserA) await User.deleteOne({ _id: testUserA._id });
    if (testUserB) await User.deleteOne({ _id: testUserB._id });
    if (testProblem) await Problem.deleteOne({ _id: testProblem._id });
    if (activeRoom) await Room.deleteOne({ _id: activeRoom._id });
    if (closedRoom) await Room.deleteOne({ _id: closedRoom._id });

    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("\n❌ Stage 10.3 API test suite failure:", err);
  process.exit(1);
});
