require("dotenv").config();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const http = require("http");
const User = require("./models/User");
const Problem = require("./models/Problem");
const Room = require("./models/Room");
const Submission = require("./models/Submission");

// Helper function to perform HTTP JSON requests to the running backend
function makeRequest({ method, path, headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : "";
    const req = http.request(
      {
        hostname: "localhost",
        port: 5000,
        path,
        method,
        headers: {
          "Content-Type": "application/json",
          ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          try {
            const json = data ? JSON.parse(data) : {};
            resolve({ statusCode: res.statusCode, data: json });
          } catch {
            resolve({ statusCode: res.statusCode, raw: data });
          }
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// C++ Solutions for tests
const solutions = {
  twoSumCorrect: `
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> map;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (map.count(complement)) {
                return {map[complement], i};
            }
            map[nums[i]] = i;
        }
        return {};
    }
};`,

  twoSumWrong: `
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {999, 999};
    }
};`,

  twoSumFailsNegativeHidden: `
#include <vector>
#include <unordered_map>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        if (target <= 0) {
            return {0, 0};
        }
        unordered_map<int, int> map;
        for (int i = 0; i < nums.size(); ++i) {
            int complement = target - nums[i];
            if (map.count(complement)) {
                return {map[complement], i};
            }
            map[nums[i]] = i;
        }
        return {};
    }
};`,

  syntaxError: `
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        compilation_error_here!
    }
};`,

  runtimeError: `
#include <vector>
using namespace std;

class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        int* p = nullptr;
        *p = 42; // SIGSEGV
        return {0, 1};
    }
};`
};

async function runTestSuite() {
  console.log("==================================================");
  console.log("Verifying Stage 5: Run & Submit HTTP Endpoints");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("[DB] Connected to MongoDB");

  // 1. Setup Test User
  let testUser = await User.findOne({ email: "stage5_tester@example.com" });
  if (!testUser) {
    testUser = await User.create({
      name: "Stage 5 Tester",
      email: "stage5_tester@example.com",
      password: "password123",
    });
  }

  // Setup Other User (for unauthorized room access testing)
  let otherUser = await User.findOne({ email: "other_user@example.com" });
  if (!otherUser) {
    otherUser = await User.create({
      name: "Other User",
      email: "other_user@example.com",
      password: "password123",
    });
  }

  const token = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 2. Fetch Two Sum Problem from DB
  const problem = await Problem.findOne({ slug: "two-sum" });
  if (!problem) {
    throw new Error("Two Sum problem not found in database. Please run seedProblems.js first.");
  }
  const problemId = problem._id.toString();

  // 3. Setup Test Room
  const testRoomId = "test-room-stage5";
  await Room.deleteMany({ roomId: testRoomId });
  const room = await Room.create({
    roomId: testRoomId,
    roomName: "Stage 5 Test Room",
    createdBy: testUser._id,
    users: [testUser._id],
    language: "cpp",
  });

  // Setup Restricted Room (testUser is NOT a member)
  const restrictedRoomId = "restricted-room-stage5";
  await Room.deleteMany({ roomId: restrictedRoomId });
  await Room.create({
    roomId: restrictedRoomId,
    roomName: "Restricted Room",
    createdBy: otherUser._id,
    users: [otherUser._id],
    language: "cpp",
  });

  let passed = 0;
  let totalTests = 0;

  // ----------------------------------------------------
  // RUN ENDPOINT TESTS (POST /api/submissions/run)
  // ----------------------------------------------------

  // TEST 1: Authenticated valid code -> visible tests execute and pass
  totalTests++;
  try {
    console.log("\n[TEST 1] POST /api/submissions/run - Valid C++ Solution...");
    const beforeCount = await Submission.countDocuments({ user: testUser._id });

    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/run",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.twoSumCorrect,
      },
    });

    if (res.statusCode !== 200 || !res.data?.success) {
      throw new Error(`Expected HTTP 200 and success: true, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    const { result } = res.data;
    if (result.status !== "accepted" || result.passedTestCases !== 3 || result.totalTestCases !== 3) {
      throw new Error(`Expected 3/3 passed tests with status 'accepted', got ${result.passedTestCases}/${result.totalTestCases} (${result.status})`);
    }

    const afterCount = await Submission.countDocuments({ user: testUser._id });
    if (beforeCount !== afterCount) {
      throw new Error(`Run endpoint created a Submission document! Expected no persistence.`);
    }

    console.log(`[PASS] Run executed visible tests (3/3) successfully without persisting Submission`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 1 failed:", err.message);
  }

  // TEST 2: Wrong code -> wrong_answer status
  totalTests++;
  try {
    console.log("\n[TEST 2] POST /api/submissions/run - Wrong Answer Solution...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/run",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.twoSumWrong,
      },
    });

    if (res.statusCode !== 200 || res.data?.result?.status !== "wrong_answer") {
      throw new Error(`Expected status 'wrong_answer', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Run returned status 'wrong_answer' with failedTestCase diagnostic`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 2 failed:", err.message);
  }

  // TEST 3: Compilation error in Run
  totalTests++;
  try {
    console.log("\n[TEST 3] POST /api/submissions/run - Compilation Error...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/run",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.syntaxError,
      },
    });

    if (res.statusCode !== 200 || res.data?.result?.status !== "compilation_error") {
      throw new Error(`Expected status 'compilation_error', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Run returned status 'compilation_error'`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 3 failed:", err.message);
  }

  // TEST 4: Runtime error in Run
  totalTests++;
  try {
    console.log("\n[TEST 4] POST /api/submissions/run - Runtime Error...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/run",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.runtimeError,
      },
    });

    if (res.statusCode !== 200 || res.data?.result?.status !== "runtime_error") {
      throw new Error(`Expected status 'runtime_error', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Run returned status 'runtime_error'`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 4 failed:", err.message);
  }

  // TEST 5: Unauthorized room access rejected
  totalTests++;
  try {
    console.log("\n[TEST 5] POST /api/submissions/run - Unauthorized Room Access...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/run",
      headers: authHeaders,
      body: {
        problemId,
        roomId: restrictedRoomId,
        language: "cpp",
        code: solutions.twoSumCorrect,
      },
    });

    if (res.statusCode !== 403) {
      throw new Error(`Expected HTTP 403 Forbidden, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Rejected run request with 403 when user is not a member of the room`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 5 failed:", err.message);
  }

  // ----------------------------------------------------
  // SUBMIT ENDPOINT TESTS (POST /api/submissions/submit)
  // ----------------------------------------------------

  // TEST 6: Authenticated correct code -> Accepted Submission persisted
  totalTests++;
  let acceptedSubId = null;
  try {
    console.log("\n[TEST 6] POST /api/submissions/submit - Accepted Submission...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/submit",
      headers: authHeaders,
      body: {
        problemId,
        roomId: testRoomId,
        language: "cpp",
        code: solutions.twoSumCorrect,
      },
    });

    if (res.statusCode !== 200 || !res.data?.success) {
      throw new Error(`Expected HTTP 200 and success: true, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    const { submission } = res.data;
    if (submission.status !== "Accepted") {
      throw new Error(`Expected status 'Accepted', got '${submission.status}'`);
    }
    if (submission.passedTestCases !== 8 || submission.totalTestCases !== 8) {
      throw new Error(`Expected 8/8 test cases, got ${submission.passedTestCases}/${submission.totalTestCases}`);
    }

    acceptedSubId = submission.id || submission._id;
    const dbSub = await Submission.findById(acceptedSubId);
    if (!dbSub || dbSub.status !== "Accepted") {
      throw new Error(`Submission was not properly persisted in MongoDB with status 'Accepted'`);
    }
    if (!dbSub.room || dbSub.room.toString() !== room._id.toString()) {
      throw new Error(`Submission room was not correctly associated with room document ID`);
    }

    console.log(`[PASS] Submit executed all 8 test cases and persisted Accepted submission with room ID`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 6 failed:", err.message);
  }

  // TEST 7: Intentionally wrong code -> Wrong Answer persisted
  totalTests++;
  try {
    console.log("\n[TEST 7] POST /api/submissions/submit - Wrong Answer Submission...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/submit",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.twoSumWrong,
      },
    });

    if (res.statusCode !== 200 || res.data?.submission?.status !== "Wrong Answer") {
      throw new Error(`Expected status 'Wrong Answer', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    const dbSub = await Submission.findById(res.data.submission._id || res.data.submission.id);
    if (!dbSub || dbSub.status !== "Wrong Answer") {
      throw new Error(`Wrong Answer submission not found in database with status 'Wrong Answer'`);
    }

    console.log(`[PASS] Submit persisted Wrong Answer submission`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 7 failed:", err.message);
  }

  // TEST 8: Hidden failure -> Hidden test privacy protection
  totalTests++;
  try {
    console.log("\n[TEST 8] POST /api/submissions/submit - Hidden Test Failure & Privacy Protection...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/submit",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.twoSumFailsNegativeHidden,
      },
    });

    if (res.statusCode !== 200 || res.data?.submission?.status !== "Wrong Answer") {
      throw new Error(`Expected status 'Wrong Answer', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    const { submission } = res.data;
    if (submission.passedTestCases !== 3) {
      throw new Error(`Expected 3 passed visible test cases before failing hidden test, got ${submission.passedTestCases}`);
    }

    // Verify privacy in response:
    if (!submission.failedTestCase || !submission.failedTestCase.isHidden) {
      throw new Error("failedTestCase should indicate isHidden: true");
    }
    if ("input" in submission.failedTestCase || "expected" in submission.failedTestCase || "actual" in submission.failedTestCase) {
      throw new Error("Hidden test failure leaked input/expected/actual in HTTP response failedTestCase!");
    }

    const hiddenResult = submission.testResults.find((r) => r.isHidden);
    if (hiddenResult && ("input" in hiddenResult || "expectedOutput" in hiddenResult || "actualOutput" in hiddenResult)) {
      throw new Error("Hidden test failure leaked input/expectedOutput/actualOutput in HTTP response testResults!");
    }

    console.log(`[PASS] Hidden test failure persisted Wrong Answer while strictly redacting hidden test data`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 8 failed:", err.message);
  }

  // TEST 9: Compilation error in Submit
  totalTests++;
  try {
    console.log("\n[TEST 9] POST /api/submissions/submit - Compilation Error Submission...");
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/submit",
      headers: authHeaders,
      body: {
        problemId,
        language: "cpp",
        code: solutions.syntaxError,
      },
    });

    if (res.statusCode !== 200 || res.data?.submission?.status !== "Compilation Error") {
      throw new Error(`Expected status 'Compilation Error', got HTTP ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Submit persisted Compilation Error submission`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 9 failed:", err.message);
  }

  // TEST 10: Nonexistent Problem ID -> 404
  totalTests++;
  try {
    console.log("\n[TEST 10] POST /api/submissions/submit - Nonexistent Problem ID...");
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await makeRequest({
      method: "POST",
      path: "/api/submissions/submit",
      headers: authHeaders,
      body: {
        problemId: fakeId,
        language: "cpp",
        code: solutions.twoSumCorrect,
      },
    });

    if (res.statusCode !== 404) {
      throw new Error(`Expected HTTP 404, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    console.log(`[PASS] Rejected nonexistent problem with HTTP 404`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 10 failed:", err.message);
  }

  // TEST 11: GET /api/submissions/problem/:problemId/history
  totalTests++;
  try {
    console.log("\n[TEST 11] GET /api/submissions/problem/:problemId/history - History Retrieval...");
    const res = await makeRequest({
      method: "GET",
      path: `/api/submissions/problem/${problemId}/history`,
      headers: authHeaders,
    });

    if (res.statusCode !== 200 || !Array.isArray(res.data?.submissions)) {
      throw new Error(`Expected HTTP 200 with submissions array, got ${res.statusCode}: ${JSON.stringify(res.data)}`);
    }

    if (res.data.submissions.length === 0) {
      throw new Error(`Expected at least 1 submission in history, got 0`);
    }

    console.log(`[PASS] Retrieved submission history (${res.data.submissions.length} submissions found)`);
    passed++;
  } catch (err) {
    console.error("[FAIL] TEST 11 failed:", err.message);
  }

  console.log("\n==================================================");
  console.log(`Verification finished: ${passed}/${totalTests} tests passed successfully.`);
  console.log("==================================================");

  await mongoose.connection.close();

  if (passed !== totalTests) {
    process.exit(1);
  }
}

runTestSuite();
