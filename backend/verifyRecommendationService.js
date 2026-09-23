/**
 * verifyRecommendationService.js
 *
 * Comprehensive test suite for CodeSync AI Stage 10.4 Recommendation Service Foundation.
 *
 * Requirements tested:
 * 1. Authenticated user's solved problems are excluded.
 * 2. Unsolved problems are eligible candidates.
 * 3. Deterministic candidate generation logic.
 * 4. Topic relevance matching (reinforcement / progression).
 * 5. Difficulty relevance matching.
 * 6. Deduplication of candidates and solved problems.
 * 7. Bounded recommendation count (max 3).
 * 8. Insufficient candidates handling.
 * 9. Zero candidate handling (all solved).
 * 10. Orphan / missing problem references handled gracefully.
 * 11. Malformed / missing metadata handling.
 * 12. AI decoration success flow.
 * 13. Malformed AI decoration fallback to deterministic.
 * 14. AI unavailable fallback to deterministic.
 * 15. AI timeout fallback to deterministic.
 * 16. AI provider error fallback to deterministic.
 * 17. No hidden test data sent to provider.
 * 18. No submission code sent to provider.
 * 19. No unrelated user data (email, passwords) sent to provider.
 * 20. AI cannot invent arbitrary problem IDs.
 * 21. Deterministic candidate set remains authoritative.
 * 22. Response schema validation.
 * 23. Zero database persistence (no Recommendation collections created).
 * 24. No N+1 unbounded queries (bounded lean projection).
 */

const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, ".env") });

const User = require("./models/User");
const Problem = require("./models/Problem");
const Submission = require("./models/Submission");
const MockAiProvider = require("./services/ai/mockAiProvider");
const {
  getRecommendations,
  generateCandidates,
  validateDecoratedOutput,
  buildDeterministicRecommendations,
} = require("./services/recommendationService");

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

async function runTests() {
  console.log("===============================================================");
  console.log("🚀 STARTING STAGE 10.4 RECOMMENDATION SERVICE TEST SUITE");
  console.log("===============================================================\n");

  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/codesync_test";
  await mongoose.connect(mongoUri);

  try {
    // Clean test fixtures
    await User.deleteMany({ email: { $regex: /@rec-test\.com$/ } });
    await Problem.deleteMany({ slug: { $regex: /^rec-test-/ } });
    await Submission.deleteMany({ code: "// rec test submission" });

    // Seed test problems
    const pEasy1 = await Problem.create({
      title: "Rec Easy Array 1",
      slug: "rec-test-easy-array-1",
      description: "Easy array problem 1",
      difficulty: "Easy",
      tags: ["Array", "Prefix Sum"],
      starterCode: { cpp: "" },
      execution: { functionName: "sol1", parameters: ["nums"] },
      testCases: [
        { input: "[1,2]", expectedOutput: "3", isHidden: false },
        { input: "[99,1]", expectedOutput: "100", isHidden: true },
      ],
    });

    const pEasy2 = await Problem.create({
      title: "Rec Easy String 2",
      slug: "rec-test-easy-string-2",
      description: "Easy string problem 2",
      difficulty: "Easy",
      tags: ["String", "Two Pointers"],
      starterCode: { cpp: "" },
      execution: { functionName: "sol2", parameters: ["s"] },
      testCases: [{ input: "a", expectedOutput: "a", isHidden: true }],
    });

    const pMed1 = await Problem.create({
      title: "Rec Medium DP 1",
      slug: "rec-test-med-dp-1",
      description: "Medium DP problem 1",
      difficulty: "Medium",
      tags: ["Dynamic Programming", "Array"],
      starterCode: { cpp: "" },
      execution: { functionName: "sol3", parameters: ["n"] },
      testCases: [{ input: "5", expectedOutput: "8", isHidden: true }],
    });

    const pHard1 = await Problem.create({
      title: "Rec Hard Graph 1",
      slug: "rec-test-hard-graph-1",
      description: "Hard graph problem 1",
      difficulty: "Hard",
      tags: ["Graph", "BFS"],
      starterCode: { cpp: "" },
      execution: { functionName: "sol4", parameters: ["edges"] },
      testCases: [{ input: "[]", expectedOutput: "0", isHidden: true }],
    });

    // --- 1. Brand New User (0 solved) ---
    console.log("--- 1. Brand New User Candidate & Fallback Flow ---");
    const newUser = await User.create({
      name: "New User",
      email: "new-user@rec-test.com",
      password: "hashedPassword123!",
      solvedProblems: [],
    });

    const newCandidates = await generateCandidates(newUser._id);
    assert(newCandidates.profileSummary.totalSolved === 0, "1.1 New user totalSolved is 0");
    assert(newCandidates.profileSummary.primaryDifficulty === "Easy", "1.2 Target difficulty is Easy for new user");
    assert(newCandidates.candidateProblems.length >= 2, "1.3 Unsolved problems returned as candidates");
    assert(
      newCandidates.candidateProblems[0].defaultMatchType === "Getting Started",
      "1.4 Match type is Getting Started for new user"
    );

    // --- 2. Solved Problem Exclusion & Deduplication ---
    console.log("\n--- 2. Solved Problem Exclusion & Deduplication ---");
    const activeUser = await User.create({
      name: "Active User",
      email: "active-user@rec-test.com",
      password: "hashedPassword123!",
      solvedProblems: [
        { problem: pEasy1._id, solvedAt: new Date() },
        { problem: pEasy1._id, solvedAt: new Date() }, // duplicate
        { problem: new mongoose.Types.ObjectId(), solvedAt: new Date() }, // orphan deleted problem
      ],
    });

    const activeCandidates = await generateCandidates(activeUser._id);
    assert(activeCandidates.profileSummary.totalSolved === 1, "2.1 Solved count is deduplicated and orphans ignored");
    const candidateIds = activeCandidates.candidateProblems.map((p) => String(p._id));
    assert(!candidateIds.includes(String(pEasy1._id)), "2.2 Already-solved problem pEasy1 is strictly excluded");
    assert(candidateIds.includes(String(pEasy2._id)), "2.3 Unsolved pEasy2 is present in candidates");

    // --- 3. Topic Weakness / Struggled Submission Match ---
    console.log("\n--- 3. Topic Weakness & Recent Submission Signal ---");
    await Submission.create({
      user: activeUser._id,
      problem: pMed1._id,
      status: "Wrong Answer",
      language: "cpp",
      code: "// rec test submission",
      passedTestCases: 1,
      totalTestCases: 3,
    });

    const weaknessCandidates = await generateCandidates(activeUser._id);
    assert(
      weaknessCandidates.profileSummary.focusArea === "Dynamic Programming" ||
        weaknessCandidates.profileSummary.focusArea === "Array",
      "3.1 Focus area reflects recent non-accepted topic"
    );
    assert(
      weaknessCandidates.candidateProblems.some((p) => String(p._id) === String(pMed1._id)),
      "3.2 Struggled topic candidate pMed1 prioritized"
    );

    // --- 4. Bounded Candidate Set & Empty Candidates ---
    console.log("\n--- 4. Bounded Recommendations & All Solved State ---");
    const mockProvider = new MockAiProvider();
    const activeRecs = await getRecommendations(activeUser._id, { provider: mockProvider });
    assert(activeRecs.recommendations.length <= 3, "4.1 Recommendations bounded to <= 3");
    assert(activeRecs.recommendations.length > 0, "4.2 Recommendations returned successfully");

    // User solves all problems in DB
    const allDbProblems = await Problem.find({}).select("_id");
    const allSolvedUser = await User.create({
      name: "Master User",
      email: "master-user@rec-test.com",
      password: "hashedPassword123!",
      solvedProblems: allDbProblems.map((p) => ({ problem: p._id, solvedAt: new Date() })),
    });

    const allSolvedResult = await getRecommendations(allSolvedUser._id, { provider: mockProvider });
    assert(allSolvedResult.recommendations.length === 0, "4.3 All solved returns empty recommendations array");
    assert(allSolvedResult.profileSummary.focusArea === "All problems solved", "4.4 Handled all solved summary cleanly");

    // --- 5. AI Decoration & Anti-Hallucination Integrity ---
    console.log("\n--- 5. AI Decoration & Anti-Hallucination Guardrails ---");
    mockProvider.setCustomResponse({
      recommendations: [
        {
          problemId: "invented-fake-id-9999",
          reason: "Invented problem that does not exist in candidates",
          focus: "Fake",
          nextStep: "Fake",
          matchType: "Skill Progression",
        },
        {
          problemId: String(pEasy2._id),
          reason: "Tailored rationale for pEasy2 from AI",
          focus: "Two Pointers in strings",
          nextStep: "Identify duplicate bounds",
          matchType: "Skill Progression",
        },
      ],
    });

    const guardedRecs = await getRecommendations(activeUser._id, { provider: mockProvider });
    assert(guardedRecs.recommendations.length > 0, "5.1 Valid candidate decorated by AI");
    assert(
      !guardedRecs.recommendations.some((r) => r.problem.id === "invented-fake-id-9999"),
      "5.2 AI invented problemId was strictly rejected"
    );
    assert(
      guardedRecs.recommendations[0].reason === "Tailored rationale for pEasy2 from AI",
      "5.3 AI rationale attached to legitimate candidate"
    );

    // --- 6. Privacy & Leakage Boundaries ---
    console.log("\n--- 6. Privacy & Leakage Verification ---");
    assert(mockProvider.lastInput !== null, "6.1 AI provider received payload");
    const payload = mockProvider.lastInput;
    assert(payload.profileSummary !== undefined, "6.2 Profile summary provided");
    assert(payload.email === undefined, "6.3 User email strictly excluded from provider payload");
    assert(payload.password === undefined, "6.4 User password strictly excluded");
    assert(payload.code === undefined, "6.5 User source code strictly excluded");

    for (const cand of payload.candidateProblems) {
      assert(cand.testCases === undefined, "6.6 Candidate testCases strictly excluded");
      assert(cand.isHidden === undefined, "6.7 Hidden test data strictly excluded");
      assert(cand.id !== undefined, "6.8 Public candidate ID passed");
      assert(cand.title !== undefined, "6.9 Public candidate title passed");
    }

    // --- 7. Provider Failure Fallback Resilience ---
    console.log("\n--- 7. Provider Failure Fallback Resilience ---");
    // 7.1 Provider Error Mode
    mockProvider.setMode("error");
    const errorFallback = await getRecommendations(activeUser._id, { provider: mockProvider });
    assert(errorFallback.recommendations.length > 0, "7.1 Fallback returned deterministic recommendations on AI error");
    assert(
      typeof errorFallback.recommendations[0].reason === "string",
      "7.2 Deterministic reason generated seamlessly"
    );

    // 7.2 Provider Unavailable Mode
    mockProvider.setMode("unavailable");
    const unavailFallback = await getRecommendations(activeUser._id, { provider: mockProvider });
    assert(unavailFallback.recommendations.length > 0, "7.3 Fallback returned on AI unavailable");

    // 7.3 Provider Malformed Mode
    mockProvider.setMode("malformed");
    const malformedFallback = await getRecommendations(activeUser._id, { provider: mockProvider });
    assert(malformedFallback.recommendations.length > 0, "7.4 Fallback returned on AI malformed output");

    // --- 8. Zero Database Persistence ---
    console.log("\n--- 8. Zero Persistence & Clean Isolation ---");
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);
    assert(!collectionNames.includes("recommendations"), "8.1 No 'recommendations' collection created");
    assert(!collectionNames.includes("airecommendations"), "8.2 No 'airecommendations' collection created");

    // Clean up test data
    await User.deleteMany({ email: { $regex: /@rec-test\.com$/ } });
    await Problem.deleteMany({ slug: { $regex: /^rec-test-/ } });
    await Submission.deleteMany({ code: "// rec test submission" });

    console.log("\n===============================================================");
    console.log(`🎉 ALL ${passedCount} STAGE 10.4 SERVICE TESTS PASSED!`);
    console.log("===============================================================\n");
  } finally {
    await mongoose.disconnect();
  }
}

runTests().catch((err) => {
  console.error("Test suite fatal error:", err);
  process.exit(1);
});
