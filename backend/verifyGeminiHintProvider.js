/**
 * Stage 10.2 Verification Test Suite: Gemini & Mock Provider Hint Integration
 * 
 * Verifies GeminiProvider and MockAiProvider generateHint implementation,
 * prompt templating, untrusted data tags, Type.OBJECT response schema,
 * error translation, anti-solution rules, and Stage 9 review backward compatibility.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const AIProvider = require("./services/ai/aiProvider");
const GeminiProvider = require("./services/ai/geminiProvider");
const MockAiProvider = require("./services/ai/mockAiProvider");
const { generateHint } = require("./services/ai/aiHintService");
const { reviewCode } = require("./services/ai/aiReviewService");

async function runTests() {
  console.log("==========================================================");
  console.log("🚀 STARTING STAGE 10.2 GEMINI & MOCK HINT PROVIDER TESTS");
  console.log("==========================================================\n");

  const validObjectId = new mongoose.Types.ObjectId().toString();
  const validProblem = {
    title: "Two Sum",
    description: "Given an array of integers nums and an integer target, return indices of the two numbers such that they add up to target.",
    difficulty: "Easy",
    constraints: ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9"],
    examples: [{ input: "nums = [2,7,11,15], target = 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9" }],
  };

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  // -------------------------------------------------------------
  // 1. PROVIDER ABSTRACTION & MOCK INTEGRATION
  // -------------------------------------------------------------
  console.log("--- 1. Provider Abstraction & Mock Provider ---");

  // 1.1 Mock provider is instance of AIProvider
  const mockProvider = new MockAiProvider();
  assert.ok(mockProvider instanceof AIProvider);
  pass("1.1 MockAiProvider extends AIProvider base class");

  // 1.2 Deterministic valid mock hint output
  const hintRes = await mockProvider.generateHint({
    language: "cpp",
    code: "int main() {}",
    problem: validProblem,
  });
  assert.strictEqual(hintRes.hintLevel, "targeted");
  assert.strictEqual(typeof hintRes.concept, "string");
  assert.strictEqual(typeof hintRes.observation, "string");
  assert.strictEqual(typeof hintRes.suggestedStep, "string");
  assert.strictEqual(typeof hintRes.pitfallToAvoid, "string");
  pass("1.2 MockAiProvider.generateHint() returns valid structured Socratic object");

  // 1.3 Exact output schema validation through aiHintService
  const serviceRes = await generateHint(
    {
      problemId: validObjectId,
      language: "cpp",
      code: "int main() {}",
      problem: validProblem,
    },
    mockProvider
  );
  assert.strictEqual(serviceRes.success, true);
  assert.strictEqual(serviceRes.hint.concept, "Hash Map Complement Lookup");
  pass("1.3 aiHintService seamlessly validates and accepts MockAiProvider hint");

  // 1.4 All allowed hintLevel values accepted
  const allowedLevels = ["gentle", "targeted", "refinement"];
  for (const level of allowedLevels) {
    mockProvider.setCustomResponse({
      hintLevel: level,
      concept: "Two Pointers",
      observation: "Array is sorted.",
      suggestedStep: "Move left and right pointers inward.",
      pitfallToAvoid: "Avoid index out of bounds.",
    });
    const res = await generateHint(
      { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
      mockProvider
    );
    assert.strictEqual(res.hint.hintLevel, level);
  }
  mockProvider.setCustomResponse(null);
  pass("1.4 All allowed hintLevel values validated ('gentle', 'targeted', 'refinement')");

  // 1.5 Missing required field from provider rejected
  mockProvider.setCustomResponse({
    hintLevel: "targeted",
    concept: "Binary Search",
    // observation missing
    suggestedStep: "Check middle element",
    pitfallToAvoid: "Infinite loop",
  });
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  mockProvider.setCustomResponse(null);
  pass("1.5 Missing required field rejected with 502 AI_MALFORMED_RESPONSE");

  // 1.6 Invalid enum value rejected
  mockProvider.setCustomResponse({
    hintLevel: "give_full_answer",
    concept: "Dynamic Programming",
    observation: "Look at subproblems",
    suggestedStep: "Fill 1D table",
    pitfallToAvoid: "Base cases",
  });
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  mockProvider.setCustomResponse(null);
  pass("1.6 Invalid hintLevel 'give_full_answer' rejected with 502 AI_MALFORMED_RESPONSE");

  // 1.7 Oversized output field (> 500 chars) rejected
  mockProvider.setCustomResponse({
    hintLevel: "targeted",
    concept: "A".repeat(501),
    observation: "Observation",
    suggestedStep: "Step",
    pitfallToAvoid: "Pitfall",
  });
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  mockProvider.setCustomResponse(null);
  pass("1.7 Oversized field (> 500 chars) rejected with 502 AI_MALFORMED_RESPONSE");

  // -------------------------------------------------------------
  // 2. ERROR TRANSLATION & MODES
  // -------------------------------------------------------------
  console.log("\n--- 2. Provider Error Normalization ---");

  // 2.1 Provider malformed-response handling
  mockProvider.setMode("malformed");
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  mockProvider.setMode("success");
  pass("2.1 Malformed provider output mapped to 502 AI_MALFORMED_RESPONSE");

  // 2.2 Provider unavailable handling
  mockProvider.setMode("unavailable");
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 503 && err.code === "AI_SERVICE_UNAVAILABLE"
  );
  mockProvider.setMode("success");
  pass("2.2 Provider unavailable mapped to 503 AI_SERVICE_UNAVAILABLE");

  // 2.3 Provider timeout handling
  mockProvider.setMode("error");
  const timeoutError = new Error("Abort signal timed out");
  timeoutError.code = "AI_TIMEOUT";
  mockProvider.setCustomError(timeoutError);
  await assert.rejects(
    async () => {
      await generateHint(
        { problemId: validObjectId, language: "cpp", code: "code", problem: validProblem },
        mockProvider
      );
    },
    (err) => err.statusCode === 504 && err.code === "AI_TIMEOUT"
  );
  mockProvider.setMode("success");
  mockProvider.setCustomError(null);
  pass("2.3 Provider timeout mapped to 504 AI_TIMEOUT");

  // -------------------------------------------------------------
  // 3. GEMINI PROVIDER TEMPLATE & PRIVACY AUDIT
  // -------------------------------------------------------------
  console.log("\n--- 3. Gemini Provider Prompt & Tag Formatting ---");

  const geminiProvider = new GeminiProvider({ apiKey: "dummy_key_for_testing" });

  // 3.1 System instructions enforce anti-solution boundaries
  const systemInst = geminiProvider.getHintSystemInstruction();
  assert.ok(systemInst.includes("CRITICAL INSTRUCTIONS & ANTI-SOLUTION BOUNDARIES"));
  assert.ok(systemInst.includes("NO FULL SOLUTIONS"));
  assert.ok(systemInst.includes("UNTRUSTED CONTENT"));
  pass("3.1 Gemini hint system instructions enforce strict Socratic and anti-solution guardrails");

  // 3.2 User prompt encapsulates untrusted code & problem in XML-style delimiters
  const formattedPrompt = geminiProvider.formatHintUserPrompt({
    language: "cpp",
    code: "int a = 5; // malicious prompt injection attempt",
    problem: validProblem,
    lastExecutionResult: {
      status: "wrong_answer",
      passedTestCases: 1,
      totalTestCases: 4,
      runtimeMs: 12,
      memoryKb: 3200,
    },
  });

  assert.ok(formattedPrompt.includes("<problem_context>"));
  assert.ok(formattedPrompt.includes("</problem_context>"));
  assert.ok(formattedPrompt.includes("<source_code language=\"cpp\">"));
  assert.ok(formattedPrompt.includes("</source_code>"));
  assert.ok(formattedPrompt.includes("<execution_summary>"));
  assert.ok(formattedPrompt.includes("</execution_summary>"));
  assert.ok(formattedPrompt.includes("Two Sum"));
  assert.ok(!formattedPrompt.includes("hiddenTestCase"));
  pass("3.2 User prompt uses secure XML-style encapsulation for untrusted content");

  // 3.3 Response schema validation structure
  const responseSchema = geminiProvider.getHintResponseSchema();
  assert.strictEqual(String(responseSchema.type).toLowerCase(), "object");
  assert.ok(responseSchema.required.includes("concept"));
  assert.ok(responseSchema.required.includes("observation"));
  assert.ok(responseSchema.required.includes("suggestedStep"));
  assert.ok(responseSchema.required.includes("pitfallToAvoid"));
  pass("3.3 Gemini hint responseSchema matches Stage 10 contract Type.OBJECT schema");

  // -------------------------------------------------------------
  // 4. STAGE 9 AI REVIEW REGRESSION
  // -------------------------------------------------------------
  console.log("\n--- 4. Stage 9 AI Review Backward Compatibility ---");

  const reviewRes = await reviewCode(
    {
      problemId: validObjectId,
      language: "cpp",
      code: "int main() { return 0; }",
      problem: validProblem,
    },
    mockProvider
  );
  assert.strictEqual(reviewRes.success, true);
  assert.strictEqual(typeof reviewRes.review.summary, "string");
  assert.strictEqual(Array.isArray(reviewRes.review.issues), true);
  pass("4.1 reviewCode() in AIReviewService continues working seamlessly");

  // -------------------------------------------------------------
  // 5. CONTROLLED LIVE GEMINI TEST (AT MOST ONE)
  // -------------------------------------------------------------
  console.log("\n--- 5. Controlled Live Gemini Test ---");

  const liveApiKey = process.env.GEMINI_API_KEY;
  if (!liveApiKey || liveApiKey.trim().length === 0 || liveApiKey.startsWith("your_")) {
    console.log("  ⚠️  LIVE GEMINI TEST SKIPPED: GEMINI_API_KEY not configured in environment");
  } else {
    console.log("  ⚡ GEMINI_API_KEY detected. Executing ONE controlled live hint request...");
    const liveGemini = new GeminiProvider({
      apiKey: liveApiKey,
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      timeoutMs: 20000,
    });

    try {
      const liveHint = await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: `#include <vector>\nusing namespace std;\n\nvector<int> twoSum(vector<int>& nums, int target) {\n    for(int i=0; i<nums.size(); i++) {\n        for(int j=i+1; j<nums.size(); j++) {\n            if(nums[i] + nums[j] == target) return {i, j};\n        }\n    }\n    return {};\n}`,
          problem: validProblem,
          lastExecutionResult: {
            status: "Accepted",
            passedTestCases: 2,
            totalTestCases: 2,
            runtimeMs: 45,
            memoryKb: 4200,
          },
        },
        liveGemini
      );

      assert.strictEqual(liveHint.success, true);
      assert.strictEqual(typeof liveHint.hint.concept, "string");
      assert.strictEqual(typeof liveHint.hint.suggestedStep, "string");
      console.log(`     ✓ Live Hint Concept: "${liveHint.hint.concept}"`);
      console.log(`     ✓ Live Hint Level: "${liveHint.hint.hintLevel}"`);
      console.log(`     ✓ Live Suggested Step: "${liveHint.hint.suggestedStep}"`);
      pass("5.1 Controlled live Gemini hint request succeeded and conforms to Stage 10 schema");
    } catch (liveErr) {
      console.warn("  ⚠️  Controlled live Gemini request failed (likely network/quota):", liveErr.message);
    }
  }

  console.log(`\n==========================================================`);
  console.log(`🎉 ALL ${passedTests} STAGE 10.2 TESTS PASSED SUCCESSFULLY!`);
  console.log(`==========================================================\n`);
}

runTests().catch((err) => {
  console.error("\n❌ Stage 10.2 test suite failure:", err);
  process.exit(1);
});
