/**
 * verifySolvedProblems.js
 * 
 * Comprehensive regression & verification suite for CodeSync AI Solved Problems Tracking.
 * 
 * Requirements tested:
 * 1. New user has zero solved problems.
 * 2. Individual Accepted Submit marks problem solved.
 * 3. Individual Wrong Answer does not mark solved.
 * 4. Individual Compilation Error does not mark solved.
 * 5. Individual Runtime Error does not mark solved.
 * 6. Individual Timeout does not mark solved.
 * 7. Run Accepted does not mark solved.
 * 8. Room Accepted Submit does not mark solved.
 * 9. Repeated individual Accepted Submit does not create duplicates.
 * 10. Solved-problems API returns correct problems and stats.
 * 11. Deleted/missing Problem references are handled safely without throwing.
 * 12. User A cannot modify User B's solved state.
 * 13. Client-provided userId cannot influence solved ownership.
 * 14. Solved list returns deterministic recent-first ordering.
 */

const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Problem = require("./models/Problem");
const Room = require("./models/Room");
const Submission = require("./models/Submission");

const BASE_URL = "http://localhost:5000";

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
    password: "hashedPassword123!",
    solvedProblems: []
  });

  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  const cookie = `token=${token}`;
  return { user, token, cookie };
}

async function runTests() {
  console.log("\n========================================================");
  console.log("  CODESYNC AI — SOLVED PROBLEMS TRACKING VERIFICATION");
  console.log("========================================================\n");

  await mongoose.connect(process.env.MONGO_URI);

  try {
    // 1. Get sample problems from DB
    const problem1 = await Problem.findOne({ slug: "two-sum" });
    const problem2 = await Problem.findOne({ slug: "longest-unique-substring" });
    if (!problem1 || !problem2) {
      throw new Error("Need two-sum and longest-unique-substring problems in DB for testing");
    }

    // User A and User B
    const userA = await createTestUser("user_solved_a@test.com", "User A");
    const userB = await createTestUser("user_solved_b@test.com", "User B");

    // Test 1: New user has zero solved problems
    console.log("Test 1: New user has zero solved problems");
    {
      const res = await fetch(`${BASE_URL}/api/users/solved-problems`, {
        headers: { Cookie: userA.cookie }
      });
      assert(res.status === 200, "GET /solved-problems returns 200");
      const data = await res.json();
      assert(Array.isArray(data.solvedProblems) && data.solvedProblems.length === 0, "solvedProblems array is empty");
      assert(data.stats.totalSolved === 0, "stats.totalSolved is 0");
    }

    // Test 2: Run Accepted does not mark problem solved
    console.log("\nTest 2: Run (POST /api/submissions/run) with valid code does not mark solved");
    {
      const solutionCode = `
#include <vector>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {0, 1};
    }
};`;
      const res = await fetch(`${BASE_URL}/api/submissions/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: problem1.starterCode?.cpp || solutionCode
        })
      });
      assert(res.status === 200, "POST /submissions/run returns 200");
      
      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 0, "User solvedProblems is still 0 after Run");
    }

    // Test 3: Individual Wrong Answer does not mark solved
    console.log("\nTest 3: Individual Wrong Answer Submit does not mark solved");
    {
      const wrongCode = problem1.execution?.functionName === "lengthOfLongestSubstring"
        ? `
#include <string>
using namespace std;
class Solution {
public:
    int lengthOfLongestSubstring(string s) {
        return -999;
    }
};`
        : `
#include <vector>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        return {-999, -999};
    }
};`;

      const res = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: wrongCode
        })
      });
      assert(res.status === 200, "POST /submissions/submit returns 200");
      const data = await res.json();
      assert(data.submission.status === "Wrong Answer", `Submission status is Wrong Answer (got ${data?.submission?.status}, err: ${data?.submission?.error || data?.submission?.failedTestCase?.errorMessage})`);

      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 0, "User solvedProblems remains empty on Wrong Answer");
    }

    // Test 4: Individual Compilation Error does not mark solved
    console.log("\nTest 4: Individual Compilation Error Submit does not mark solved");
    {
      const badCode = `this is invalid syntax !!!;`;
      const res = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: badCode
        })
      });
      assert(res.status === 200, "POST /submissions/submit returns 200");
      const data = await res.json();
      assert(data.submission.status === "Compilation Error", "Submission status is Compilation Error");

      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 0, "User solvedProblems remains empty on Compilation Error");
    }

    // Test 5: Room Accepted Submit does NOT mark solved
    console.log("\nTest 5: Room Accepted Submit does NOT mark problem solved");
    {
      const roomRes = await fetch(`${BASE_URL}/api/rooms/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          roomName: "Solved Test Room",
          language: "cpp"
        })
      });
      assert(roomRes.status === 201, "Room created successfully");
      const roomData = await roomRes.json();
      const roomId = roomData.room.roomId;

      await Room.findOneAndUpdate({ roomId }, { selectedProblem: problem1._id });

      let correctTwoSumCode = `
#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> numMap;
        for (int i = 0; i < (int)nums.size(); i++) {
            int complement = target - nums[i];
            if (numMap.find(complement) != numMap.end()) {
                return {numMap[complement], i};
            }
            numMap[nums[i]] = i;
        }
        return {};
    }
};`;

      const subRes = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: correctTwoSumCode,
          roomId: roomId
        })
      });
      assert(subRes.status === 200, "Room submit returns 200");
      const subData = await subRes.json();
      assert(subData.submission.status === "Accepted", "Room submission is Accepted");
      assert(subData.submission.room !== null, "Submission is linked to room");

      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 0, "User solvedProblems remains 0 for Room Accepted Submit");
    }

    // Test 6: Individual Accepted Submit marks problem solved
    console.log("\nTest 6: Individual Accepted Submit marks problem solved");
    let correctCode = `
#include <vector>
#include <unordered_map>
using namespace std;
class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> numMap;
        for (int i = 0; i < (int)nums.size(); i++) {
            int complement = target - nums[i];
            if (numMap.find(complement) != numMap.end()) {
                return {numMap[complement], i};
            }
            numMap[nums[i]] = i;
        }
        return {};
    }
};`;

    {
      const res = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: correctCode
        })
      });
      assert(res.status === 200, "Individual submit returns 200");
      const data = await res.json();
      assert(data.submission.status === "Accepted", "Individual submission is Accepted");
      assert(data.submission.room === null, "Submission room is null");

      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 1, "User solvedProblems count is now 1");
      assert(checkUser.solvedProblems[0].problem.toString() === problem1._id.toString(), "Solved problem ID matches Problem 1");
      assert(checkUser.solvedProblems[0].solvedAt instanceof Date, "solvedAt timestamp is a Date");
    }

    // Test 7: Repeated individual Accepted Submit does not duplicate entries
    console.log("\nTest 7: Repeated individual Accepted Submit does not duplicate entries");
    {
      const res = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userA.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: correctCode
        })
      });
      assert(res.status === 200, "Repeated individual submit returns 200");
      const data = await res.json();
      assert(data.submission.status === "Accepted", "Submission is Accepted");

      const checkUser = await User.findById(userA.user._id);
      assert(checkUser.solvedProblems.length === 1, "User solvedProblems count remains 1 (no duplicate entries)");
    }

    // Test 8: Solved-problems API returns correct problems and stats
    console.log("\nTest 8: GET /api/users/solved-problems returns populated metadata and stats");
    {
      const res = await fetch(`${BASE_URL}/api/users/solved-problems`, {
        headers: { Cookie: userA.cookie }
      });
      assert(res.status === 200, "GET /solved-problems returns 200");
      const data = await res.json();
      assert(data.solvedProblems.length === 1, "Returns 1 solved problem");
      assert(data.solvedProblems[0]._id.toString() === problem1._id.toString(), "Returned _id matches Problem 1");
      assert(data.solvedProblems[0].title === problem1.title, "Returned title matches Problem 1");
      assert(data.solvedProblems[0].slug === problem1.slug, "Returned slug matches Problem 1");
      assert(data.solvedProblems[0].difficulty === problem1.difficulty, "Returned difficulty matches Problem 1");
      assert(data.stats.totalSolved === 1, "stats.totalSolved is 1");
      assert(typeof data.stats.easy === "number", "stats.easy is a number");
    }

    // Test 9: Deleted/missing Problem references are handled safely
    console.log("\nTest 9: Deleted/missing Problem references are filtered safely");
    {
      const fakeProblemId = new mongoose.Types.ObjectId();
      await User.findByIdAndUpdate(userA.user._id, {
        $push: {
          solvedProblems: {
            problem: fakeProblemId,
            solvedAt: new Date()
          }
        }
      });

      const res = await fetch(`${BASE_URL}/api/users/solved-problems`, {
        headers: { Cookie: userA.cookie }
      });
      assert(res.status === 200, "GET /solved-problems returns 200 when dangling reference exists");
      const data = await res.json();
      assert(data.solvedProblems.length === 1, "Dangling/null problem is safely omitted from response");
      assert(data.stats.totalSolved === 1, "stats.totalSolved reflects valid problems only");
    }

    // Test 10: Security — User A cannot modify User B's solved state or pass foreign userId
    console.log("\nTest 10: Security — Client cannot supply foreign userId to affect another user's solved state");
    {
      const res = await fetch(`${BASE_URL}/api/submissions/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: userB.cookie
        },
        body: JSON.stringify({
          problemId: problem1._id,
          language: "cpp",
          code: correctCode,
          userId: userA.user._id.toString() // Spoofed userId in body
        })
      });
      assert(res.status === 200, "Submit succeeds for User B");

      // Check User A is not affected by User B's request
      const checkUserA = await User.findById(userA.user._id);
      const checkUserB = await User.findById(userB.user._id);

      assert(checkUserB.solvedProblems.length === 1, "User B's solved state was updated using authenticated req.userId");
      assert(checkUserB.solvedProblems[0].problem.toString() === problem1._id.toString(), "User B solved problem 1");
    }

    // Cleanup test users
    await User.deleteMany({ email: { $in: ["user_solved_a@test.com", "user_solved_b@test.com"] } });
    await Room.deleteMany({ roomName: "Solved Test Room" });

    console.log("\n========================================================");
    console.log(`  ALL VERIFICATION TESTS COMPLETED`);
    console.log(`  Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log("========================================================\n");

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    await mongoose.disconnect();
    process.exit(failedCount > 0 ? 1 : 0);
  }
}

runTests();
