/**
 * Stage 9.1 Verification Test Suite
 * 
 * Verifies AI Provider Interface, Mock AI Provider, Input/Output Validation,
 * Security/Privacy Guardrails, and Service Layer Behavior.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const AIProvider = require("./services/ai/aiProvider");
const MockAiProvider = require("./services/ai/mockAiProvider");
const {
  reviewCode,
  validateReviewInput,
  validateReviewOutput,
  ALLOWED_LANGUAGES,
  ALLOWED_SEVERITIES,
  ALLOWED_CATEGORIES,
} = require("./services/ai/aiReviewService");

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING STAGE 9.1 AI REVIEW FOUNDATION TESTS");
  console.log("=================================================\n");

  const validObjectId = new mongoose.Types.ObjectId().toString();
  const validProblem = {
    title: "Two Sum",
    description: "Find indices summing to target",
    difficulty: "Easy",
    constraints: ["2 <= nums.length <= 104"],
    examples: [{ input: "[2,7,11,15], 9", output: "[0,1]" }],
  };

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  // -------------------------------------------------------------
  // SECTION 1: INPUT VALIDATION
  // -------------------------------------------------------------
  console.log("--- 1. Input Validation Matrix ---");

  // 1. Valid cpp input
  const cppInput = validateReviewInput({
    problemId: validObjectId,
    language: "cpp",
    code: "int main() { return 0; }",
  });
  assert.strictEqual(cppInput.language, "cpp");
  pass("1.1 Valid cpp input accepted");

  // 2. Valid javascript input
  const jsInput = validateReviewInput({
    problemId: validObjectId,
    language: "javascript",
    code: "function twoSum() { return [0, 1]; }",
  });
  assert.strictEqual(jsInput.language, "javascript");
  pass("1.2 Valid javascript input accepted");

  // 3. Valid python input
  const pyInput = validateReviewInput({
    problemId: validObjectId,
    language: "python",
    code: "def twoSum(): pass",
  });
  assert.strictEqual(pyInput.language, "python");
  pass("1.3 Valid python input accepted");

  // 4. Valid java input
  const javaInput = validateReviewInput({
    problemId: validObjectId,
    language: "java",
    code: "class Solution {}",
  });
  assert.strictEqual(javaInput.language, "java");
  pass("1.4 Valid java input accepted");

  // 5. Missing problemId
  assert.throws(
    () => validateReviewInput({ language: "cpp", code: "int x;" }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("problemId is required")
  );
  pass("1.5 Missing problemId rejected with AI_INVALID_INPUT");

  // 6. Invalid problemId format
  assert.throws(
    () => validateReviewInput({ problemId: "invalid-id", language: "cpp", code: "int x;" }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("Invalid problemId")
  );
  pass("1.6 Malformed problemId format rejected");

  // 7. Missing language
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, code: "int x;" }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("language is required")
  );
  pass("1.7 Missing language rejected");

  // 8. Unsupported language
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, language: "rust", code: "fn main() {}" }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("Unsupported language")
  );
  pass("1.8 Unsupported language (rust) rejected");

  // 9. Missing code
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, language: "cpp" }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("Code is required")
  );
  pass("1.9 Missing code field rejected");

  // 10. Empty code
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, language: "cpp", code: "   " }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("cannot be empty")
  );
  pass("1.10 Empty/whitespace-only code rejected");

  // 11. Code > 65,536 chars
  const oversizedCode = "a".repeat(65537);
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, language: "cpp", code: oversizedCode }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("exceeds maximum")
  );
  pass("1.11 Oversized code (>64KB) rejected");

  // 12. Invalid roomId format
  assert.throws(
    () => validateReviewInput({ problemId: validObjectId, language: "cpp", code: "int x;", roomId: "   " }),
    (err) => err.code === "AI_INVALID_INPUT" && err.message.includes("Invalid roomId")
  );
  pass("1.12 Empty/invalid roomId rejected");

  // 13. Execution summary whitelisting
  const validatedWithExec = validateReviewInput({
    problemId: validObjectId,
    language: "cpp",
    code: "int x;",
    lastExecutionResult: {
      status: "Accepted",
      passedTestCases: 2,
      totalTestCases: 2,
      runtimeMs: 12,
      memoryKb: 4000,
      untrustedHiddenData: "forbidden",
    },
  });
  assert.strictEqual(validatedWithExec.lastExecutionResult.status, "Accepted");
  assert.strictEqual(validatedWithExec.lastExecutionResult.passedTestCases, 2);
  assert.strictEqual(validatedWithExec.lastExecutionResult.untrustedHiddenData, undefined);
  pass("1.13 Execution summary strictly whitelisted; unauthorized fields stripped");

  // -------------------------------------------------------------
  // SECTION 2: AI PROVIDER INTERFACE & MOCK PROVIDER
  // -------------------------------------------------------------
  console.log("\n--- 2. AI Provider Abstraction & Mock Provider ---");

  // 14. Abstract class instantiation check
  const baseProvider = new AIProvider();
  await assert.rejects(
    async () => await baseProvider.reviewCode({}),
    (err) => err.message.includes("must be implemented by concrete AI provider")
  );
  pass("2.1 Base AIProvider enforces abstract reviewCode() contract");

  // 15. Mock provider inheritance
  const mock = new MockAiProvider();
  assert.ok(mock instanceof AIProvider);
  pass("2.2 MockAiProvider properly extends AIProvider interface");

  // 16. Successful deterministic response
  const mockRes = await mock.reviewCode({ language: "python", code: "def sol(): pass" });
  assert.ok(mockRes.summary.includes("python"));
  assert.ok(mockRes.verdictAssessment.timeComplexity);
  assert.strictEqual(mock.callCount, 1);
  pass("2.3 MockAiProvider returns valid deterministic review response");

  // 17. Provider error simulation
  mock.setMode("error");
  await assert.rejects(
    async () => await mock.reviewCode({}),
    (err) => err.message.includes("Simulated AI provider failure")
  );
  pass("2.4 MockAiProvider handles simulated error mode");

  // 18. Provider unavailable mode
  mock.setMode("unavailable");
  await assert.rejects(
    async () => await mock.reviewCode({}),
    (err) => err.code === "SERVICE_UNAVAILABLE"
  );
  pass("2.5 MockAiProvider handles service unavailable mode");

  // -------------------------------------------------------------
  // SECTION 3: OUTPUT SCHEMA VALIDATION
  // -------------------------------------------------------------
  console.log("\n--- 3. Output Schema Validation Matrix ---");

  const validOutputTemplate = {
    summary: "Solid two-pointer implementation with linear runtime.",
    verdictAssessment: {
      executionAlignment: "Consistent with test results",
      timeComplexity: "O(N)",
      spaceComplexity: "O(1)",
      complexityAnalysis: "Single loop over N elements.",
    },
    issues: [
      {
        id: "issue-1",
        category: "edge_case",
        severity: "medium",
        title: "Missing empty array guard",
        lineRange: { start: 2, end: 5 },
        explanation: "nums[0] accessed directly.",
        recommendation: "Check if nums.length === 0.",
      },
    ],
    strengths: ["Clean logic", "No extra memory"],
    actionableSuggestions: ["Add type assertions", "Use const instead of let"],
  };

  // 19. Valid complete output
  const normalizedOutput = validateReviewOutput(validOutputTemplate);
  assert.strictEqual(normalizedOutput.summary, validOutputTemplate.summary);
  assert.strictEqual(normalizedOutput.issues.length, 1);
  pass("3.1 Complete compliant response validated successfully");

  // 20. Missing summary
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, summary: "" }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("missing 'summary'")
  );
  pass("3.2 Missing summary string rejected");

  // 21. Summary > 300 chars
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, summary: "x".repeat(301) }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("exceeds 300 characters")
  );
  pass("3.3 Oversized summary rejected (>300 chars)");

  // 22. Missing verdictAssessment
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, verdictAssessment: null }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("missing 'verdictAssessment'")
  );
  pass("3.4 Missing verdictAssessment object rejected");

  // 23. Invalid complexity structure
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      verdictAssessment: { timeComplexity: "O(N)" }, // missing spaceComplexity, etc.
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("invalid or missing complexity fields")
  );
  pass("3.5 Incomplete complexity fields rejected");

  // 24. Malformed issues array
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, issues: "not-an-array" }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("'issues' must be an array")
  );
  pass("3.6 Non-array issues rejected");

  // 25. Invalid issue severity
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      issues: [{ ...validOutputTemplate.issues[0], severity: "catastrophic" }],
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("Invalid issue severity")
  );
  pass("3.7 Unlisted severity value rejected");

  // 26. Invalid issue category
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      issues: [{ ...validOutputTemplate.issues[0], category: "philosophy" }],
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("Invalid issue category")
  );
  pass("3.8 Unlisted category value rejected");

  // 27. Invalid lineRange format
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      issues: [{ ...validOutputTemplate.issues[0], lineRange: { start: 10, end: 2 } }], // end < start
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("malformed lineRange")
  );
  pass("3.9 Inverted lineRange (start > end) rejected");

  // 28. Strengths < 1 item
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, strengths: [] }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("'strengths' must be an array containing between 1 and 5")
  );
  pass("3.10 Empty strengths array rejected (<1)");

  // 29. Strengths > 5 items
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      strengths: ["1", "2", "3", "4", "5", "6"],
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("'strengths' must be an array containing between 1 and 5")
  );
  pass("3.11 Oversized strengths array rejected (>5)");

  // 30. Actionable suggestions < 1 item
  assert.throws(
    () => validateReviewOutput({ ...validOutputTemplate, actionableSuggestions: [] }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("'actionableSuggestions' must be an array containing between 1 and 5")
  );
  pass("3.12 Empty actionableSuggestions array rejected (<1)");

  // 31. Actionable suggestions > 5 items
  assert.throws(
    () => validateReviewOutput({
      ...validOutputTemplate,
      actionableSuggestions: ["1", "2", "3", "4", "5", "6"],
    }),
    (err) => err.code === "AI_MALFORMED_RESPONSE" && err.message.includes("'actionableSuggestions' must be an array containing between 1 and 5")
  );
  pass("3.13 Oversized actionableSuggestions array rejected (>5)");

  // 32. Totally broken / null provider response
  assert.throws(
    () => validateReviewOutput(null),
    (err) => err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.14 Null or non-object response rejected");

  // -------------------------------------------------------------
  // SECTION 4: SECURITY, PRIVACY & SENSITIVE DATA PREVENTION
  // -------------------------------------------------------------
  console.log("\n--- 4. Security & Privacy Guardrails ---");

  // 33. Hidden test fixtures cannot pass into review input
  const contaminatedInput = {
    problemId: validObjectId,
    language: "cpp",
    code: "int a = 5;",
    hiddenTestCases: [{ input: "secret_123", expectedOutput: "secret_456" }],
    testCases: [{ input: "all_tests", isHidden: true }],
  };
  const sanitized = validateReviewInput(contaminatedInput);
  assert.strictEqual(sanitized.hiddenTestCases, undefined);
  assert.strictEqual(sanitized.testCases, undefined);
  pass("4.1 Hidden test cases stripped from review input payload");

  // 34. User account / session attributes stripped
  const accountContaminatedInput = {
    problemId: validObjectId,
    language: "javascript",
    code: "const x = 1;",
    password: "hashed_password",
    email: "user@test.com",
    token: "jwt.session.token",
  };
  const sanitizedAccount = validateReviewInput(accountContaminatedInput);
  assert.strictEqual(sanitizedAccount.password, undefined);
  assert.strictEqual(sanitizedAccount.email, undefined);
  assert.strictEqual(sanitizedAccount.token, undefined);
  pass("4.2 User account and auth credentials stripped from review payload");

  // 35. Public problem examples preserved without leaking unformatted metadata
  const sanitizedProblemContext = validateReviewInput({
    problemId: validObjectId,
    language: "java",
    code: "class Sol {}",
    problem: {
      title: "Valid Anagram",
      description: "Check if s and t are anagrams",
      difficulty: "Easy",
      constraints: ["1 <= s.length <= 5 * 104"],
      examples: [{ input: "anagram, nagaram", output: "true" }],
      internalSecretSolution: "class HiddenSol {}",
    },
  });
  assert.strictEqual(sanitizedProblemContext.problem.title, "Valid Anagram");
  assert.strictEqual(sanitizedProblemContext.problem.internalSecretSolution, undefined);
  pass("4.3 Problem context whitelisted; hidden internal solutions stripped");

  // 36. Allowed categories and severities invariants
  assert.deepStrictEqual(ALLOWED_LANGUAGES, ["cpp", "javascript", "python", "java"]);
  assert.deepStrictEqual(ALLOWED_SEVERITIES, ["critical", "high", "medium", "low", "info"]);
  assert.ok(ALLOWED_CATEGORIES.includes("correctness"));
  assert.ok(ALLOWED_CATEGORIES.includes("performance"));
  assert.ok(ALLOWED_CATEGORIES.includes("edge_case"));
  pass("4.4 Strict enumeration constants verified");

  // -------------------------------------------------------------
  // SECTION 5: SERVICE LAYER EXECUTION & NORMALIZATION
  // -------------------------------------------------------------
  console.log("\n--- 5. Service Layer Execution & Integration ---");

  // 37. Service calls provider exactly once
  const serviceMock = new MockAiProvider();
  const serviceResult = await reviewCode(
    {
      problemId: validObjectId,
      language: "cpp",
      code: "int main() { return 0; }",
      problem: validProblem,
    },
    serviceMock
  );
  assert.strictEqual(serviceMock.callCount, 1);
  pass("5.1 Service invokes provider exactly once");

  // 38. Service returns success: true and validated review
  assert.strictEqual(serviceResult.success, true);
  assert.ok(serviceResult.review.summary);
  assert.ok(serviceResult.review.verdictAssessment);
  assert.ok(Array.isArray(serviceResult.review.issues));
  assert.ok(Array.isArray(serviceResult.review.strengths));
  assert.ok(Array.isArray(serviceResult.review.actionableSuggestions));
  pass("5.2 Service returns structured response adhering to Stage 9.0 contract");

  // 39. Malformed provider output caught and translated to AI_MALFORMED_RESPONSE
  serviceMock.setMode("malformed");
  await assert.rejects(
    async () =>
      await reviewCode(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() { return 0; }",
        },
        serviceMock
      ),
    (err) => err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("5.3 Malformed provider response safely converted to AppError (502 AI_MALFORMED_RESPONSE)");

  // 40. Missing/Invalid provider instance caught
  await assert.rejects(
    async () =>
      await reviewCode(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() { return 0; }",
        },
        null
      ),
    (err) => err.code === "AI_SERVICE_UNAVAILABLE"
  );
  pass("5.4 Null provider instance rejected with AI_SERVICE_UNAVAILABLE (503)");

  // 41. Provider runtime error caught and translated to AI_PROVIDER_ERROR
  serviceMock.setMode("error");
  await assert.rejects(
    async () =>
      await reviewCode(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() { return 0; }",
        },
        serviceMock
      ),
    (err) => err.code === "AI_PROVIDER_ERROR"
  );
  pass("5.5 Provider runtime exception converted to AppError (502 AI_PROVIDER_ERROR)");

  // 42. Provider unavailable caught and translated to AI_SERVICE_UNAVAILABLE
  serviceMock.setMode("unavailable");
  await assert.rejects(
    async () =>
      await reviewCode(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() { return 0; }",
        },
        serviceMock
      ),
    (err) => err.code === "AI_SERVICE_UNAVAILABLE"
  );
  pass("5.6 Provider unavailable status mapped to AppError (503 AI_SERVICE_UNAVAILABLE)");

  console.log("\n=================================================");
  console.log(`🎉 ALL ${passedTests} AI REVIEW FOUNDATION TESTS PASSED!`);
  console.log("=================================================");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
