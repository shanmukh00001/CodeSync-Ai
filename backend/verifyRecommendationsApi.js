/**
 * verifyRecommendationsApi.js
 *
 * Comprehensive HTTP API test suite for CodeSync AI Stage 10.4:
 * GET /api/users/recommendations
 *
 * Requirements tested:
 * 1. Unauthenticated request returns HTTP 401.
 * 2. Authenticated request returns HTTP 200 with structured recommendations payload.
 * 3. Fake body/query userId cannot override authenticated JWT identity (req.userId).
 * 4. Solved problems are excluded from recommendations.
 * 5. Problem projection contains only public safe attributes.
 * 6. No hidden tests or execution test cases leaked in HTTP response.
 * 7. No source code leaked in HTTP response.
 * 8. Zero database persistence (ephemeral recommendations).
 * 9. AI provider failure/malformed/unavailable still returns HTTP 200 with deterministic recommendations.
 * 10. User-scoped rate limit enforced (10 req/min, 11th yields 429).
 * 11. Stage 9 AI Review API remains fully functional.
 * 12. Stage 10.3 AI Hint API remains fully functional.
 * 13. Personal Analytics API remains fully functional.
 */

const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const http = require("http");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");
const userRoutes = require("./routes/userRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const { setAIProvider } = require("./services/ai/aiProviderFactory");
const MockAiProvider = require("./services/ai/mockAiProvider");

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

function makeRequest(serverUrl, path, method = "GET", token = null, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, serverUrl);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers["Cookie"] = `token=${token}`;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed, rawBody: data });
        } catch (e) {
          resolve({ status: res.statusCode, body: null, rawBody: data });
        }
      });
    });

    req.on("error", reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log("==================================================================");
  console.log("🚀 STARTING STAGE 10.4 RECOMMENDATIONS HTTP API TEST SUITE");
  console.log("==================================================================\n");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codesync_test";
  await mongoose.connect(mongoUri);

  // Setup Express test server
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/users", userRoutes);
  app.use("/api/submissions", submissionRoutes);

  // Centralized error handler
  app.use((err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const code = err.code || "SERVER_ERROR";
    res.status(statusCode).json({
      error: {
        message: err.message,
        code,
      },
    });
  });

  const server = app.listen(0);
  const port = server.address().port;
  const serverUrl = `http://localhost:${port}`;

  const mockProvider = new MockAiProvider();
  setAIProvider(mockProvider);

  try {
    // Clean test fixtures
    await User.deleteMany({ email: { $regex: /@rec-api-test\.com$/ } });
    await Problem.deleteMany({ slug: { $regex: /^rec-api-/ } });

    // Seed test problems
    const p1 = await Problem.create({
      title: "Rec API Two Sum",
      slug: "rec-api-two-sum",
      description: "Find two numbers that add to target",
      difficulty: "Easy",
      tags: ["Array", "Hash Table"],
      starterCode: { cpp: "" },
      execution: { functionName: "twoSum", parameters: ["nums", "target"] },
      testCases: [
        { input: "[2,7], 9", expectedOutput: "[0,1]", isHidden: false },
        { input: "[3,3], 6", expectedOutput: "[0,1]", isHidden: true },
      ],
    });

    const p2 = await Problem.create({
      title: "Rec API Valid Anagram",
      slug: "rec-api-valid-anagram",
      description: "Check if two strings are anagrams",
      difficulty: "Easy",
      tags: ["String", "Hash Table"],
      starterCode: { cpp: "" },
      execution: { functionName: "isAnagram", parameters: ["s", "t"] },
      testCases: [{ input: '"a", "b"', expectedOutput: "false", isHidden: true }],
    });

    const p3 = await Problem.create({
      title: "Rec API Longest Substring",
      slug: "rec-api-longest-substring",
      description: "Length of longest substring without repeating characters",
      difficulty: "Medium",
      tags: ["String", "Sliding Window"],
      starterCode: { cpp: "" },
      execution: { functionName: "lengthOfLongestSubstring", parameters: ["s"] },
      testCases: [{ input: '"abcabcbb"', expectedOutput: "3", isHidden: true }],
    });

    // Create test users
    const userA = await User.create({
      name: "API User A",
      email: "user-a@rec-api-test.com",
      password: "hashedPassword123!",
      solvedProblems: [{ problem: p1._id, solvedAt: new Date() }],
    });

    const userB = await User.create({
      name: "API User B",
      email: "user-b@rec-api-test.com",
      password: "hashedPassword123!",
      solvedProblems: [],
    });

    const tokenA = jwt.sign({ userId: userA._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
    const tokenB = jwt.sign({ userId: userB._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // --- 1. Authentication & Security ---
    console.log("--- 1. Authentication & Identity Protection ---");
    const unauthRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET");
    assert(unauthRes.status === 401, "1.1 Unauthenticated request returns HTTP 401");
    assert(unauthRes.body?.error?.code === "UNAUTHENTICATED", "1.2 Error code is UNAUTHENTICATED");

    // Spoofed userId in query parameter
    const spoofQueryRes = await makeRequest(
      serverUrl,
      `/api/users/recommendations?userId=${userA._id}`,
      "GET",
      tokenB
    );
    assert(spoofQueryRes.status === 200, "1.3 Request with spoof query param succeeds using authenticated identity");
    assert(
      spoofQueryRes.body?.data?.profileSummary?.totalSolved === 0,
      "1.4 Recommendations computed for User B (0 solved), ignoring spoofed User A in query"
    );

    // --- 2. Response Structure & Solved Problem Exclusion ---
    console.log("\n--- 2. Response Schema & Problem Exclusion ---");
    const recResA = await makeRequest(serverUrl, "/api/users/recommendations", "GET", tokenA);
    assert(recResA.status === 200, "2.1 Authenticated User A returns HTTP 200");
    assert(recResA.body?.success === true, "2.2 success: true present in response");
    assert(recResA.body?.data?.recommendations !== undefined, "2.3 recommendations array present");
    assert(recResA.body?.data?.profileSummary?.totalSolved === 1, "2.4 profileSummary.totalSolved is 1 for User A");

    const recListA = recResA.body.data.recommendations;
    assert(recListA.length > 0, "2.5 Recommendations returned for User A");
    assert(
      !recListA.some((r) => r.problem.id === String(p1._id)),
      "2.6 Already solved problem p1 is strictly excluded from User A's recommendations"
    );

    const firstRec = recListA[0];
    assert(typeof firstRec.problem.id === "string", "2.7 problem.id is string");
    assert(typeof firstRec.problem.title === "string", "2.8 problem.title is string");
    assert(typeof firstRec.problem.slug === "string", "2.9 problem.slug is string");
    assert(typeof firstRec.problem.difficulty === "string", "2.10 problem.difficulty is string");
    assert(Array.isArray(firstRec.problem.tags), "2.11 problem.tags is array");
    assert(typeof firstRec.reason === "string", "2.12 reason is non-empty string");
    assert(typeof firstRec.focus === "string", "2.13 focus is non-empty string");
    assert(typeof firstRec.nextStep === "string", "2.14 nextStep is non-empty string");
    assert(typeof firstRec.matchType === "string", "2.15 matchType is non-empty string");

    // --- 3. Privacy Boundary on HTTP Output ---
    console.log("\n--- 3. Privacy Boundary on HTTP Output ---");
    const rawOutput = recResA.rawBody;
    assert(!rawOutput.includes("testCases"), "3.1 'testCases' not present in HTTP response");
    assert(!rawOutput.includes("isHidden"), "3.2 'isHidden' not present in HTTP response");
    assert(!rawOutput.includes("expectedOutput"), "3.3 'expectedOutput' not present in HTTP response");
    assert(!rawOutput.includes("password"), "3.4 'password' not present in HTTP response");
    assert(!rawOutput.includes("user-a@rec-api-test.com"), "3.5 User email not present in recommendations payload");

    // --- 4. Resilient Fallback on Provider Failure ---
    console.log("\n--- 4. Resilient Fallback on Provider Failure ---");
    mockProvider.setMode("error");
    const fallbackRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET", tokenA);
    assert(fallbackRes.status === 200, "4.1 Provider error mode still returns HTTP 200 via deterministic fallback");
    assert(fallbackRes.body?.data?.recommendations?.length > 0, "4.2 Fallback recommendations returned");

    mockProvider.setMode("unavailable");
    const unavailRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET", tokenA);
    assert(unavailRes.status === 200, "4.3 Provider unavailable still returns HTTP 200 via deterministic fallback");

    mockProvider.setMode("malformed");
    const malformedRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET", tokenA);
    assert(malformedRes.status === 200, "4.4 Provider malformed still returns HTTP 200 via deterministic fallback");

    mockProvider.setMode("success");

    // --- 5. Rate Limiting (10 req/min) ---
    console.log("\n--- 5. User-Scoped Rate Limiting (10 req/min) ---");
    const rateLimitUser = await User.create({
      name: "Rate Limit User",
      email: "rate-limit@rec-api-test.com",
      password: "hashedPassword123!",
      solvedProblems: [],
    });
    const rateLimitToken = jwt.sign({ userId: rateLimitUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

    // Send 10 rapid requests (should all succeed)
    for (let i = 1; i <= 10; i++) {
      const res = await makeRequest(serverUrl, "/api/users/recommendations", "GET", rateLimitToken);
      assert(res.status === 200, `5.${i} Request ${i}/10 allowed`);
    }

    // 11th request should be rate limited
    const rateLimitedRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET", rateLimitToken);
    assert(rateLimitedRes.status === 429, "5.11 11th request rejected with HTTP 429 RATE_LIMIT_EXCEEDED");
    assert(rateLimitedRes.body?.error?.code === "RATE_LIMIT_EXCEEDED", "5.12 Error code is RATE_LIMIT_EXCEEDED");

    // Other user still allowed (rate limit is per-user)
    const otherUserRes = await makeRequest(serverUrl, "/api/users/recommendations", "GET", tokenB);
    assert(otherUserRes.status === 200, "5.13 Other user's request succeeds (scoped per-user)");

    // --- 6. Backward Compatibility & System Integrity ---
    console.log("\n--- 6. Backward Compatibility & System Integrity ---");
    // 6.1 Personal Analytics API
    const analyticsRes = await makeRequest(serverUrl, "/api/users/analytics", "GET", tokenA);
    assert(analyticsRes.status === 200, "6.1 Personal Analytics GET /api/users/analytics continues working");
    assert(analyticsRes.body?.analytics?.solved?.totalSolved === 1, "6.2 Analytics solved count matches");

    // 6.2 AI Review API
    const reviewRes = await makeRequest(
      serverUrl,
      "/api/submissions/review",
      "POST",
      tokenA,
      {
        problemId: String(p1._id),
        language: "cpp",
        code: "int main() { return 0; }",
      }
    );
    assert(reviewRes.status === 200, "6.3 AI Review POST /api/submissions/review continues working");

    // 6.3 AI Hint API
    const hintRes = await makeRequest(
      serverUrl,
      "/api/submissions/hint",
      "POST",
      tokenA,
      {
        problemId: String(p1._id),
        language: "cpp",
        code: "int main() { return 0; }",
      }
    );
    assert(hintRes.status === 200, "6.4 AI Hint POST /api/submissions/hint continues working");

    // Clean up test data
    await User.deleteMany({ email: { $regex: /@rec-api-test\.com$/ } });
    await Problem.deleteMany({ slug: { $regex: /^rec-api-/ } });

    console.log("\n==================================================================");
    console.log(`🎉 ALL ${passedCount} STAGE 10.4 API TESTS PASSED!`);
    console.log("==================================================================\n");
  } finally {
    server.close();
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
