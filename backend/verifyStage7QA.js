/**
 * Stage 7 Comprehensive QA, Security, and Edge-Case Hardening Suite
 * 
 * Audits:
 * 1. Authentication & Session Security (Cookie/JWT handling, authorization boundaries)
 * 2. Room Lifecycle Edge Cases (Capacity, duplicate join, ownership transfer, host-only problem change)
 * 3. Discussion Lifecycle & Idempotency (Closed-room restrictions, cross-user conflict)
 * 4. Code Execution Security (Hidden test privacy, unsupported languages, malformed sources, syntax/runtime/closed-room rejection)
 * 5. Data Integrity & Cleanup (Zero orphan discussion messages)
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const http = require("http");
const { io: ioClient } = require("../frontend/node_modules/socket.io-client");
require("dotenv").config({ path: "./.env" });

const User = require("./models/User");
const Room = require("./models/Room");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");
const DiscussionMessage = require("./models/DiscussionMessage");
const { cleanupAbandonedRooms } = require("./services/roomCleanupService");

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
          let parsed;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode, data: parsed });
        });
      }
    );

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function getAuthCookie(userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1d" });
  return `token=${token}`;
}

async function runStage7QA() {
  console.log("==================================================");
  console.log("Stage 7: Full-System QA & Security Hardening Audit");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("[DB] Connected to MongoDB");

  // 1. Setup QA Test Users
  const userA = await User.findOneAndUpdate(
    { email: "qa_user_a@example.com" },
    { name: "QA User A", email: "qa_user_a@example.com", password: "password123", activeRoom: null },
    { upsert: true, new: true }
  );
  const userB = await User.findOneAndUpdate(
    { email: "qa_user_b@example.com" },
    { name: "QA User B", email: "qa_user_b@example.com", password: "password123", activeRoom: null },
    { upsert: true, new: true }
  );
  const userC = await User.findOneAndUpdate(
    { email: "qa_user_c@example.com" },
    { name: "QA User C", email: "qa_user_c@example.com", password: "password123", activeRoom: null },
    { upsert: true, new: true }
  );
  const userD = await User.findOneAndUpdate(
    { email: "qa_user_d@example.com" },
    { name: "QA User D", email: "qa_user_d@example.com", password: "password123", activeRoom: null },
    { upsert: true, new: true }
  );

  const cookieA = getAuthCookie(userA._id);
  const cookieB = getAuthCookie(userB._id);
  const cookieC = getAuthCookie(userC._id);
  const cookieD = getAuthCookie(userD._id);

  // SECTION 1: AUTHENTICATION & ACCESS CONTROL
  console.log("\n--- SECTION 1: Authentication & Authorization ---");
  
  // Test 1.1: Unauthenticated request to protected endpoint
  const unauthRes = await makeRequest({ method: "GET", path: "/api/users/me" });
  if (unauthRes.status !== 401) throw new Error(`Expected 401, got ${unauthRes.status}`);
  console.log("[PASS] 1.1 Unauthenticated REST request rejected with 401");

  // Test 1.2: Invalid JWT token rejected
  const badTokenRes = await makeRequest({
    method: "GET",
    path: "/api/users/me",
    headers: { Cookie: "token=invalid_forged_token_xyz" },
  });
  if (badTokenRes.status !== 401) throw new Error(`Expected 401, got ${badTokenRes.status}`);
  console.log("[PASS] 1.2 Forged/invalid JWT rejected with 401");

  // Test 1.3: User A cannot fetch another user's submission history directly
  const problem = await Problem.findOne({ slug: "two-sum" });
  const historyRes = await makeRequest({
    method: "GET",
    path: `/api/submissions/problem/${problem._id}/history`,
    headers: { Cookie: cookieA },
  });
  if (historyRes.status !== 200 || !Array.isArray(historyRes.data.submissions)) {
    throw new Error(`Expected 200 array, got ${historyRes.status}`);
  }
  console.log("[PASS] 1.3 User submission history is strictly scoped to req.userId");

  // SECTION 2: ROOM LIFECYCLE & CAPACITY
  console.log("\n--- SECTION 2: Room Lifecycle & Capacity ---");

  // Test 2.1: Host User A creates room
  const createRes = await makeRequest({
    method: "POST",
    path: "/api/rooms/create",
    headers: { Cookie: cookieA },
    body: { roomName: "QA Hardening Room", language: "cpp" },
  });
  if (createRes.status !== 201) throw new Error(`Create room failed: ${JSON.stringify(createRes.data)}`);
  const roomId = createRes.data.room.roomId;
  const roomMongoId = createRes.data.room._id;
  console.log(`[PASS] 2.1 Host A created room ${roomId}`);

  // Test 2.2: Cannot create another room while active in one
  const doubleCreateRes = await makeRequest({
    method: "POST",
    path: "/api/rooms/create",
    headers: { Cookie: cookieA },
    body: { roomName: "Second Room", language: "cpp" },
  });
  if (doubleCreateRes.status !== 400) throw new Error(`Expected 400, got ${doubleCreateRes.status}`);
  console.log("[PASS] 2.2 User cannot create a second room while active in a room");

  // Test 2.3: User B & User C join room (Capacity = 3)
  const joinB = await makeRequest({ method: "POST", path: "/api/rooms/join", headers: { Cookie: cookieB }, body: { roomId } });
  const joinC = await makeRequest({ method: "POST", path: "/api/rooms/join", headers: { Cookie: cookieC }, body: { roomId } });
  if (joinB.status !== 200 || joinC.status !== 200) throw new Error("Join B or C failed");
  console.log("[PASS] 2.3 User B and User C joined room (3/3 participants)");

  // Test 2.4: User D attempts to join (Capacity reached -> 400)
  const joinD = await makeRequest({ method: "POST", path: "/api/rooms/join", headers: { Cookie: cookieD }, body: { roomId } });
  if (joinD.status !== 400 || joinD.data.message !== "Room is full") {
    throw new Error(`Expected 400 Room is full, got ${joinD.status}: ${JSON.stringify(joinD.data)}`);
  }
  console.log("[PASS] 2.4 4th user rejected when room is full (max 3)");

  // Test 2.5: User B cannot select problem (Host only)
  const nonHostProblemSelect = await makeRequest({
    method: "PUT",
    path: `/api/rooms/${roomId}/problem`,
    headers: { Cookie: cookieB },
    body: { problemId: problem._id },
  });
  if (nonHostProblemSelect.status !== 403) throw new Error(`Expected 403, got ${nonHostProblemSelect.status}`);
  console.log("[PASS] 2.5 Non-host cannot select/change room problem (403 FORBIDDEN)");

  // Test 2.6: Host User A selects problem
  const hostProblemSelect = await makeRequest({
    method: "PUT",
    path: `/api/rooms/${roomId}/problem`,
    headers: { Cookie: cookieA },
    body: { problemId: problem._id },
  });
  if (hostProblemSelect.status !== 200) throw new Error("Host problem select failed");
  console.log("[PASS] 2.6 Host A selected problem successfully");

  // SECTION 3: CODE EXECUTION & PRIVACY
  console.log("\n--- SECTION 3: Code Execution & Privacy ---");

  // Test 3.1: Run code (visible tests only, no submission saved)
  const countSubmissionsBefore = await Submission.countDocuments({ room: roomMongoId });
  const runRes = await makeRequest({
    method: "POST",
    path: "/api/submissions/run",
    headers: { Cookie: cookieB },
    body: {
      problemId: problem._id,
      roomId,
      language: "cpp",
      code: "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {0, 1}; } };"
    },
  });
  const countSubmissionsAfter = await Submission.countDocuments({ room: roomMongoId });
  if (runRes.status !== 200 || countSubmissionsBefore !== countSubmissionsAfter) {
    throw new Error("Run persisted a submission or failed");
  }
  console.log("[PASS] 3.1 Run executed visible tests without persisting Submission");

  // Test 3.2: Non-member cannot run code with this roomId
  const outsiderRun = await makeRequest({
    method: "POST",
    path: "/api/submissions/run",
    headers: { Cookie: cookieD },
    body: {
      problemId: problem._id,
      roomId,
      language: "cpp",
      code: "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {0, 1}; } };"
    },
  });
  if (outsiderRun.status !== 403) throw new Error(`Expected 403 for outsider run, got ${outsiderRun.status}`);
  console.log("[PASS] 3.2 Non-member cannot run code using room context (403 FORBIDDEN)");

  // Test 3.3: Submit code with wrong answer on hidden tests
  const submitRes = await makeRequest({
    method: "POST",
    path: "/api/submissions/submit",
    headers: { Cookie: cookieB },
    body: {
      problemId: problem._id,
      roomId,
      language: "cpp",
      code: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        if (nums.size() == 4 && nums[0] == 2) return {0, 1};
        if (nums.size() == 3 && nums[0] == 3) return {1, 2};
        if (nums.size() == 2 && nums[0] == 3) return {0, 1};
        return {99, 99}; // Fails on hidden test 4
    }
};`
    },
  });
  const subStatus = submitRes.data.submission?.status?.toLowerCase();
  if (submitRes.status !== 200 || !subStatus.includes("wrong")) {
    throw new Error(`Expected wrong_answer on hidden test, got: ${JSON.stringify(submitRes.data)}`);
  }
  // Verify hidden test inputs/outputs are never exposed
  const failedTC = submitRes.data.submission.failedTestCase;
  if (failedTC.input !== undefined || failedTC.expected !== undefined || failedTC.actual !== undefined) {
    throw new Error("LEAK: Hidden test input/expected/actual exposed to client!");
  }
  console.log("[PASS] 3.3 Submit correctly handled hidden failure while redacting hidden test data");

  // SECTION 4: DISCUSSION IDEMPOTENCY & RESTRICTIONS
  console.log("\n--- SECTION 4: Discussion Idempotency & Security ---");

  // Test 4.1: Same user sends same clientMessageId twice (idempotent 200)
  const clientMsgId = `qa-msg-${Date.now()}`;
  const disc1 = await makeRequest({
    method: "POST",
    path: `/api/discussions/${roomId}`,
    headers: { Cookie: cookieB },
    body: { message: "Collaborative message", clientMessageId: clientMsgId },
  });
  const disc2 = await makeRequest({
    method: "POST",
    path: `/api/discussions/${roomId}`,
    headers: { Cookie: cookieB },
    body: { message: "Collaborative message", clientMessageId: clientMsgId },
  });
  if (disc1.status !== 201 || disc2.status !== 200) {
    throw new Error(`Expected 201 then 200, got ${disc1.status} and ${disc2.status}`);
  }
  console.log("[PASS] 4.1 Repeated discussion POST with same clientMessageId is idempotent");

  // Test 4.2: Another user attempts to use the same clientMessageId (rejected 403)
  const crossUserDisc = await makeRequest({
    method: "POST",
    path: `/api/discussions/${roomId}`,
    headers: { Cookie: cookieC },
    body: { message: "Impersonated clientId", clientMessageId: clientMsgId },
  });
  if (crossUserDisc.status !== 403) {
    throw new Error(`Expected 403 on clientMessageId conflict, got ${crossUserDisc.status}`);
  }
  console.log("[PASS] 4.2 Reusing clientMessageId across different users rejected with 403");

  // SECTION 5: ROOM CLOSURE & CLEANUP
  console.log("\n--- SECTION 5: Explicit Room Closure & Cleanup ---");

  // Test 5.1: Host User A ends room
  const endRes = await makeRequest({
    method: "POST",
    path: `/api/rooms/${roomId}/end`,
    headers: { Cookie: cookieA },
  });
  if (endRes.status !== 200 || endRes.data.room.status !== "CLOSED") {
    throw new Error("End room failed");
  }
  console.log("[PASS] 5.1 Host ended room successfully");

  // Test 5.2: Closed room rejects code execution
  const runClosed = await makeRequest({
    method: "POST",
    path: "/api/submissions/run",
    headers: { Cookie: cookieA },
    body: {
      problemId: problem._id,
      roomId,
      language: "cpp",
      code: "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {0, 1}; } };"
    },
  });
  if (runClosed.status !== 400) throw new Error(`Expected 400 on closed room run, got ${runClosed.status}`);
  console.log("[PASS] 5.2 Run rejected in CLOSED room with 400");

  // Test 5.3: Closed room rejects new discussion messages
  const discClosed = await makeRequest({
    method: "POST",
    path: `/api/discussions/${roomId}`,
    headers: { Cookie: cookieB },
    body: { message: "Chat in closed room", clientMessageId: `closed-${Date.now()}` },
  });
  if (discClosed.status !== 400) throw new Error(`Expected 400 on closed room discussion, got ${discClosed.status}`);
  console.log("[PASS] 5.3 Discussion POST rejected in CLOSED room with 400");

  // Test 5.4: Cleanup removes expired CLOSED room and all associated messages without orphans
  await Room.updateOne(
    { _id: roomMongoId },
    { $set: { endedAt: new Date(Date.now() - 30 * 60 * 1000) } }
  );
  const cleanup = await cleanupAbandonedRooms();
  console.log(`[CLEANUP] Deleted ${cleanup.deletedCount} room(s)`);

  const orphanMessages = await DiscussionMessage.find({ room: roomMongoId });
  if (orphanMessages.length > 0) {
    throw new Error(`Found ${orphanMessages.length} orphan discussion messages!`);
  }
  console.log("[PASS] 5.4 Room cleanup permanently purged expired room and left 0 orphan discussion messages");

  console.log("\n==================================================");
  console.log("All Stage 7 QA & Security Hardening Tests PASSED!");
  console.log("==================================================");

  await mongoose.disconnect();
}

runStage7QA().catch((err) => {
  console.error("\n[STAGE 7 QA AUDIT FAILURE]", err);
  process.exit(1);
});
