/**
 * Stage 9.2 Verification Test Suite — Gemini Provider & Integration
 * 
 * Verifies GeminiProvider construction, missing key handling, input formatting & delimiters,
 * whitelisting, error translation, timeout handling, and optional live Gemini test.
 */

require("dotenv").config();
const assert = require("assert");
const mongoose = require("mongoose");
const AIProvider = require("./services/ai/aiProvider");
const GeminiProvider = require("./services/ai/geminiProvider");
const { reviewCode, validateReviewOutput } = require("./services/ai/aiReviewService");

async function runGeminiTests() {
  console.log("=================================================");
  console.log("🚀 STARTING STAGE 9.2 GEMINI PROVIDER TESTS");
  console.log("=================================================\n");

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  const validObjectId = new mongoose.Types.ObjectId().toString();
  const sampleProblem = {
    title: "Palindrome Number",
    description: "Given an integer x, return true if x is a palindrome, and false otherwise.",
    difficulty: "Easy",
    constraints: ["-2^31 <= x <= 2^31 - 1"],
    examples: [{ input: "x = 121", output: "true" }],
  };

  // -------------------------------------------------------------
  // SECTION 1: DETERMINISTIC GEMINI PROVIDER UNIT TESTS
  // -------------------------------------------------------------
  console.log("--- 1. Gemini Provider Construction & Decoupling ---");

  // 1. Inheritance
  const provider = new GeminiProvider({ apiKey: "test-fake-key" });
  assert.ok(provider instanceof AIProvider);
  assert.strictEqual(provider.model, "gemini-3.6-flash");
  assert.strictEqual(provider.timeoutMs, 15000);
  pass("1.1 GeminiProvider properly extends AIProvider interface with default gemini-3.6-flash");

  // 2. Missing API key handling without crash
  const unconfiguredProvider = new GeminiProvider({ apiKey: null });
  await assert.rejects(
    async () => await unconfiguredProvider.reviewCode({ language: "cpp", code: "int x = 0;" }),
    (err) => err.code === "AI_SERVICE_UNAVAILABLE" && err.statusCode === 503
  );
  pass("1.2 Missing GEMINI_API_KEY gracefully returns 503 AI_SERVICE_UNAVAILABLE");

  // 3. System instruction compliance
  const systemInstruction = provider.getSystemInstruction();
  assert.ok(systemInstruction.includes("principal software engineer"));
  assert.ok(systemInstruction.includes("UNTRUSTED CONTENT"));
  assert.ok(systemInstruction.includes("<problem_context>"));
  assert.ok(systemInstruction.includes("<source_code>"));
  assert.ok(systemInstruction.includes("STRICT SCHEMA CONFORMANCE"));
  pass("1.3 System instructions enforce untrusted data boundary and anti-injection instructions");

  // 4. Prompt construction and delimiter encapsulation
  const formattedPrompt = provider.formatUserPrompt({
    language: "cpp",
    code: "bool isPalindrome(int x) { return false; }",
    problem: sampleProblem,
    lastExecutionResult: {
      status: "Accepted",
      passedTestCases: 3,
      totalTestCases: 3,
      runtimeMs: 4,
      memoryKb: 3200,
    },
  });
  assert.ok(formattedPrompt.includes("<problem_context>"));
  assert.ok(formattedPrompt.includes("Title: Palindrome Number"));
  assert.ok(formattedPrompt.includes("Difficulty: Easy"));
  assert.ok(formattedPrompt.includes("</problem_context>"));
  assert.ok(formattedPrompt.includes("<execution_summary>"));
  assert.ok(formattedPrompt.includes("Visible Tests Passed: 3/3"));
  assert.ok(formattedPrompt.includes("</execution_summary>"));
  assert.ok(formattedPrompt.includes('<source_code language="cpp">'));
  assert.ok(formattedPrompt.includes("bool isPalindrome(int x) { return false; }"));
  assert.ok(formattedPrompt.includes("</source_code>"));
  pass("1.4 User prompt encloses untrusted code, problem, and execution summary in XML-style tags");

  // 5. Zero-leak verification in formatted prompt
  const leakTestPrompt = provider.formatUserPrompt({
    language: "javascript",
    code: "console.log('hi');",
    problem: {
      title: "Public Title",
      description: "Public Desc",
      hiddenTestCases: ["SECRET_TEST_1", "SECRET_TEST_2"], // Should not be rendered by provider
    },
    hiddenInputData: "SECRET_INPUT",
    userPasswordHash: "$2b$10$abcdef",
  });
  assert.ok(!leakTestPrompt.includes("SECRET_TEST_1"));
  assert.ok(!leakTestPrompt.includes("SECRET_INPUT"));
  assert.ok(!leakTestPrompt.includes("$2b$10$abcdef"));
  pass("1.5 Prompt formatting strictly excludes unwhitelisted and sensitive fields");

  // 6. Response schema structure
  const schema = provider.getResponseSchema();
  assert.strictEqual(schema.type, "OBJECT");
  assert.ok(schema.properties.summary);
  assert.ok(schema.properties.verdictAssessment);
  assert.ok(schema.properties.issues);
  assert.ok(schema.properties.strengths);
  assert.ok(schema.properties.actionableSuggestions);
  pass("1.6 Gemini responseSchema matches Stage 9.0 output contract");

  // -------------------------------------------------------------
  // SECTION 2: LIVE GEMINI API TEST (CONTROLLED & CONDITIONAL)
  // -------------------------------------------------------------
  console.log("\n--- 2. Live Gemini Integration Check ---");

  const liveApiKey = process.env.GEMINI_API_KEY;

  if (!liveApiKey || liveApiKey.trim().length === 0 || liveApiKey === "your_gemini_api_key_here") {
    console.log("  ⚠️  LIVE GEMINI TEST SKIPPED: GEMINI_API_KEY not configured in environment");
    console.log("     (Clean skip — Deterministic test suite remains 100% green)");
  } else {
    console.log("  ⚡ GEMINI_API_KEY detected. Executing ONE controlled live review request...");

    const liveProvider = new GeminiProvider({
      apiKey: liveApiKey,
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      timeoutMs: 20000,
    });

    try {
      const liveResult = await reviewCode(
        {
          problemId: validObjectId,
          language: "javascript",
          code: `function isPalindrome(s) {
  const clean = s.toLowerCase().replace(/[^a-z0-9]/g, '');
  return clean === clean.split('').reverse().join('');
}`,
          problem: {
            title: "Valid Palindrome",
            description: "A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward.",
            difficulty: "Easy",
            constraints: ["1 <= s.length <= 2 * 105"],
            examples: [{ input: 's = "A man, a plan, a canal: Panama"', output: "true" }],
          },
          lastExecutionResult: {
            status: "Accepted",
            passedTestCases: 2,
            totalTestCases: 2,
            runtimeMs: 15,
            memoryKb: 4500,
          },
        },
        liveProvider
      );

      assert.strictEqual(liveResult.success, true);
      assert.ok(liveResult.review.summary);
      assert.ok(liveResult.review.verdictAssessment.timeComplexity);
      assert.ok(Array.isArray(liveResult.review.issues));
      assert.ok(Array.isArray(liveResult.review.strengths));
      assert.ok(Array.isArray(liveResult.review.actionableSuggestions));
      pass("2.1 LIVE Gemini request succeeded with strict structured response");
      console.log(`     Summary: "${liveResult.review.summary}"`);
      console.log(`     Time: ${liveResult.review.verdictAssessment.timeComplexity}, Space: ${liveResult.review.verdictAssessment.spaceComplexity}`);
      console.log(`     Strengths: ${liveResult.review.strengths.length}, Suggestions: ${liveResult.review.actionableSuggestions.length}`);
    } catch (liveErr) {
      console.error("  ❌ Live Gemini call failed:", liveErr.message);
      throw liveErr;
    }
  }

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests} GEMINI PROVIDER TESTS PASSED!`);
  console.log("=================================================");
}

runGeminiTests().catch((err) => {
  console.error("Gemini provider test run failed:", err);
  process.exit(1);
});
