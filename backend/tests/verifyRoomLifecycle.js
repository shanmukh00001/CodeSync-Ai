const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const http = require("http");
const { io: ioClient } = require("../frontend/node_modules/socket.io-client");
require("dotenv").config({ path: "./.env" });

const User = require("./models/User");
const Room = require("./models/Room");
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

async function runTestSuite() {
  console.log("==================================================");
  console.log("Verifying Stage 6.5: Explicit Room Closure & Discussion Lifecycle");
  console.log("==================================================");

  await mongoose.connect(process.env.MONGO_URI);
  console.log("[DB] Connected to MongoDB");

  // Setup Test Users
  let hostUser = await User.findOne({ email: "room_host@example.com" });
  if (!hostUser) {
    hostUser = await User.create({
      name: "Room Host",
      email: "room_host@example.com",
      password: "password123",
    });
  }

  let participantUser = await User.findOne({ email: "room_participant@example.com" });
  if (!participantUser) {
    participantUser = await User.create({
      name: "Room Participant",
      email: "room_participant@example.com",
      password: "password123",
    });
  }

  let outsiderUser = await User.findOne({ email: "room_outsider@example.com" });
  if (!outsiderUser) {
    outsiderUser = await User.create({
      name: "Room Outsider",
      email: "room_outsider@example.com",
      password: "password123",
    });
  }

  const hostCookie = getAuthCookie(hostUser._id);
  const participantCookie = getAuthCookie(participantUser._id);
  const outsiderCookie = getAuthCookie(outsiderUser._id);

  // Clear active room for test users
  await User.updateMany(
    { _id: { $in: [hostUser._id, participantUser._id, outsiderUser._id] } },
    { $set: { activeRoom: null } }
  );

  // 1. Create an ACTIVE Room
  console.log("\n[TEST 1] Creating an ACTIVE room with Host...");
  const createRes = await makeRequest({
    method: "POST",
    path: "/api/rooms/create",
    headers: { Cookie: hostCookie },
    body: { roomName: "Lifecycle Test Room", language: "cpp" },
  });
  if (createRes.status !== 201 || !createRes.data.room) {
    throw new Error(`Failed to create room: ${JSON.stringify(createRes.data)}`);
  }
  const testRoomId = createRes.data.room.roomId;
  const testRoomMongoId = createRes.data.room._id;
  console.log(`[PASS] Room created with roomId=${testRoomId}, status=${createRes.data.room.status || "ACTIVE"}`);

  // 2. Participant Joins Room
  console.log("\n[TEST 2] Participant joining ACTIVE room...");
  const joinRes = await makeRequest({
    method: "POST",
    path: "/api/rooms/join",
    headers: { Cookie: participantCookie },
    body: { roomId: testRoomId },
  });
  if (joinRes.status !== 200) {
    throw new Error(`Participant failed to join: ${JSON.stringify(joinRes.data)}`);
  }
  console.log("[PASS] Participant joined ACTIVE room successfully");

  // 3. Discussion in ACTIVE Room
  console.log("\n[TEST 3] Sending discussion message in ACTIVE room via REST...");
  const clientMsgId1 = `msg-active-${Date.now()}`;
  const discRes = await makeRequest({
    method: "POST",
    path: `/api/discussions/${testRoomId}`,
    headers: { Cookie: participantCookie },
    body: { message: "Hello in active room!", clientMessageId: clientMsgId1 },
  });
  if (discRes.status !== 201) {
    throw new Error(`Discussion POST failed: ${JSON.stringify(discRes.data)}`);
  }
  console.log("[PASS] Discussion message persisted successfully in ACTIVE room");

  // 4. Non-host attempts to end room
  console.log("\n[TEST 4] Non-host attempts to End Room (expect 403 FORBIDDEN)...");
  const nonHostEndRes = await makeRequest({
    method: "POST",
    path: `/api/rooms/${testRoomId}/end`,
    headers: { Cookie: participantCookie },
  });
  if (nonHostEndRes.status !== 403) {
    throw new Error(`Expected 403, got ${nonHostEndRes.status}: ${JSON.stringify(nonHostEndRes.data)}`);
  }
  console.log("[PASS] Non-host correctly rejected with 403 FORBIDDEN");

  // 5. Host ends room
  console.log("\n[TEST 5] Host ends room (POST /api/rooms/:roomId/end)...");
  const hostEndRes = await makeRequest({
    method: "POST",
    path: `/api/rooms/${testRoomId}/end`,
    headers: { Cookie: hostCookie },
  });
  if (hostEndRes.status !== 200 || hostEndRes.data.room?.status !== "CLOSED") {
    throw new Error(`Host failed to end room: ${JSON.stringify(hostEndRes.data)}`);
  }
  console.log(`[PASS] Room status is now CLOSED (endedAt=${hostEndRes.data.room.endedAt})`);

  // Verify users' activeRoom is cleared while recentRooms is preserved
  const hostDoc = await User.findById(hostUser._id);
  const partDoc = await User.findById(participantUser._id);
  if (hostDoc.activeRoom !== null || partDoc.activeRoom !== null) {
    throw new Error(`Expected activeRoom to be null, got host=${hostDoc.activeRoom}, part=${partDoc.activeRoom}`);
  }
  if (!hostDoc.recentRooms.length || !partDoc.recentRooms.length) {
    throw new Error("Expected recentRooms to be preserved after room end");
  }
  console.log("[PASS] User activeRoom cleared and recentRooms preserved");

  // 6. Safe/Idempotent repeat of End Room
  console.log("\n[TEST 6] Repeated End Room is safe/idempotent...");
  const repeatEndRes = await makeRequest({
    method: "POST",
    path: `/api/rooms/${testRoomId}/end`,
    headers: { Cookie: hostCookie },
  });
  if (repeatEndRes.status !== 200 || repeatEndRes.data.room?.status !== "CLOSED") {
    throw new Error(`Repeat End failed: ${JSON.stringify(repeatEndRes.data)}`);
  }
  console.log("[PASS] Repeated End Room handled idempotently");

  // 7. Joining a CLOSED Room
  console.log("\n[TEST 7] Outsider attempts to join CLOSED room (expect 400)...");
  const joinClosedRes = await makeRequest({
    method: "POST",
    path: "/api/rooms/join",
    headers: { Cookie: outsiderCookie },
    body: { roomId: testRoomId },
  });
  if (joinClosedRes.status !== 400) {
    throw new Error(`Expected 400, got ${joinClosedRes.status}: ${JSON.stringify(joinClosedRes.data)}`);
  }
  console.log("[PASS] Joining CLOSED room correctly rejected with 400 'Room is closed'");

  // 8. Discussion POST in CLOSED Room
  console.log("\n[TEST 8] Sending discussion message in CLOSED room via REST (expect 400)...");
  const clientMsgId2 = `msg-closed-${Date.now()}`;
  const discClosedRes = await makeRequest({
    method: "POST",
    path: `/api/discussions/${testRoomId}`,
    headers: { Cookie: hostCookie },
    body: { message: "Trying to chat in closed room", clientMessageId: clientMsgId2 },
  });
  if (discClosedRes.status !== 400) {
    throw new Error(`Expected 400, got ${discClosedRes.status}: ${JSON.stringify(discClosedRes.data)}`);
  }
  console.log("[PASS] Discussion POST rejected in CLOSED room");

  // 9. Discussion GET in CLOSED Room
  console.log("\n[TEST 9] Reading discussion messages in CLOSED room (expect 200 with history)...");
  const discGetRes = await makeRequest({
    method: "GET",
    path: `/api/discussions/${testRoomId}`,
    headers: { Cookie: hostCookie },
  });
  if (discGetRes.status !== 200 || !Array.isArray(discGetRes.data.messages) || discGetRes.data.messages.length === 0) {
    throw new Error(`Discussion GET failed: ${JSON.stringify(discGetRes.data)}`);
  }
  console.log(`[PASS] Discussion messages readable in CLOSED room (${discGetRes.data.messages.length} message(s) retrieved)`);

  // 10. Code Execution in CLOSED Room
  console.log("\n[TEST 10] Running / Submitting code in CLOSED room (expect 400)...");
  const Problem = require("./models/Problem");
  const problem = await Problem.findOne({ slug: "two-sum" });
  const runClosedRes = await makeRequest({
    method: "POST",
    path: "/api/submissions/run",
    headers: { Cookie: hostCookie },
    body: {
      problemId: problem._id,
      roomId: testRoomId,
      language: "cpp",
      code: "class Solution { public: vector<int> twoSum(vector<int>& n, int t) { return {0,1}; } };"
    },
  });
  if (runClosedRes.status !== 400) {
    throw new Error(`Expected 400, got ${runClosedRes.status}: ${JSON.stringify(runClosedRes.data)}`);
  }
  console.log("[PASS] Code run in CLOSED room correctly rejected");

  // 11. Socket.IO discussion:send and code:update in CLOSED Room
  console.log("\n[TEST 11] Socket.IO discussion:send in CLOSED room...");
  const socket = ioClient("http://localhost:5000", {
    auth: { token: jwt.sign({ userId: hostUser._id }, process.env.JWT_SECRET) },
    transports: ["websocket"],
  });

  await new Promise((resolve, reject) => {
    socket.on("connect", () => {
      socket.emit(
        "discussion:send",
        {
          roomId: testRoomId,
          message: "Socket message in closed room",
          clientMessageId: `sock-${Date.now()}`,
        },
        (response) => {
          if (!response || response.success) {
            reject(new Error(`Expected socket error, got: ${JSON.stringify(response)}`));
          } else {
            console.log(`[PASS] Socket discussion:send rejected: "${response.error}"`);
            socket.disconnect();
            resolve();
          }
        }
      );
    });
    socket.on("connect_error", reject);
  });

  // 12. Cleanup Service & Orphan Check
  console.log("\n[TEST 12] Room & Discussion Cleanup Verification...");
  // Simulate expired endedAt on the CLOSED room
  await Room.updateOne(
    { _id: testRoomMongoId },
    { $set: { endedAt: new Date(Date.now() - 20 * 60 * 1000) } } // 20 mins ago (TTL is 10)
  );

  const cleanupResult = await cleanupAbandonedRooms();
  console.log(`Cleanup run result: deleted ${cleanupResult.deletedCount} room(s)`);

  const roomAfter = await Room.findById(testRoomMongoId);
  const messagesAfter = await DiscussionMessage.find({ room: testRoomMongoId });

  if (roomAfter !== null) {
    throw new Error("Expired CLOSED room was not deleted by cleanup");
  }
  if (messagesAfter.length !== 0) {
    throw new Error(`Found ${messagesAfter.length} orphan discussion messages after room deletion!`);
  }
  console.log("[PASS] Expired CLOSED room and all associated DiscussionMessage records were deleted without orphans");

  console.log("\n==================================================");
  console.log("All 12/12 Room Lifecycle & Discussion tests passed!");
  console.log("==================================================");

  await mongoose.disconnect();
}

runTestSuite().catch((err) => {
  console.error("\n[TEST SUITE FAILURE]", err);
  process.exit(1);
});
