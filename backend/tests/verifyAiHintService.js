/**
 * Stage 10.1 Verification Test Suite: AI Hint Service Foundation
 * 
 * Verifies AIProvider interface extension, MockAiProvider hint support,
 * Input/Output validation, anti-solution schema enforcement, privacy guardrails,
 * error mapping, and backward-compatibility with Stage 9 AI Review.
 */

const assert = require("assert");
const mongoose = require("mongoose");
const AIProvider = require("./services/ai/aiProvider");
const MockAiProvider = require("./services/ai/mockAiProvider");
const {
  generateHint,
  validateHintInput,
  validateHintOutput,
  ALLOWED_LANGUAGES,
  ALLOWED_HINT_LEVELS,
  MAX_CODE_LENGTH,
} = require("./services/ai/aiHintService");
const { reviewCode } = require("./services/ai/aiReviewService");

async function runTests() {
  console.log("=======================================================");
  console.log("🚀 STARTING STAGE 10.1 AI HINT SERVICE FOUNDATION TESTS");
  console.log("=======================================================\n");

  const validObjectId = new mongoose.Types.ObjectId().toString();
  const validProblem = {
    title: "Two Sum",
    description: "Find indices summing to target",
    difficulty: "Easy",
    constraints: ["2 <= nums.length <= 10^4"],
    examples: [{ input: "[2,7,11,15], 9", output: "[0,1]", explanation: "nums[0] + nums[1] == 9" }],
  };

  let passedTests = 0;
  function pass(desc) {
    console.log(`  ✓ ${desc}`);
    passedTests++;
  }

  // -------------------------------------------------------------
  // 1. INPUT VALIDATION TESTS
  // -------------------------------------------------------------
  console.log("--- 1. Input Validation Matrix ---");

  // 1.1 Valid input accepted
  const validCpp = validateHintInput({
    problemId: validObjectId,
    language: "cpp",
    code: "int main() { return 0; }",
    problem: validProblem,
  });
  assert.strictEqual(validCpp.language, "cpp");
  assert.strictEqual(validCpp.problemId, validObjectId);
  pass("1.1 Valid cpp input accepted");

  // 1.2 All supported languages accepted
  for (const lang of ALLOWED_LANGUAGES) {
    const res = validateHintInput({
      problemId: validObjectId,
      language: lang,
      code: "test code",
      problem: validProblem,
    });
    assert.strictEqual(res.language, lang);
  }
  pass(`1.2 All supported languages accepted (${ALLOWED_LANGUAGES.join(", ")})`);

  // 1.3 Missing problem context rejected
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "cpp",
        code: "test code",
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.3 Missing problem context rejected with 400 AI_INVALID_INPUT");

  // 1.4 Missing code rejected
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "cpp",
        problem: validProblem,
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.4 Missing code rejected with 400 AI_INVALID_INPUT");

  // 1.5 Non-string code rejected
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "cpp",
        code: 12345,
        problem: validProblem,
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.5 Non-string code rejected with 400 AI_INVALID_INPUT");

  // 1.6 Oversized code rejected
  const oversizedCode = "a".repeat(MAX_CODE_LENGTH + 1);
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "cpp",
        code: oversizedCode,
        problem: validProblem,
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.6 Oversized code (> 65536 chars) rejected with 400 AI_INVALID_INPUT");

  // 1.7 Invalid language rejected
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "ruby",
        code: "puts 'hello'",
        problem: validProblem,
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.7 Invalid language 'ruby' rejected with 400 AI_INVALID_INPUT");

  // 1.8 Malformed execution summary rejected
  assert.throws(
    () => {
      validateHintInput({
        problemId: validObjectId,
        language: "cpp",
        code: "test",
        problem: validProblem,
        lastExecutionResult: "not-an-object",
      });
    },
    (err) => err.statusCode === 400 && err.code === "AI_INVALID_INPUT"
  );
  pass("1.8 Non-object execution summary rejected with 400 AI_INVALID_INPUT");

  // -------------------------------------------------------------
  // 2. PRIVACY & SANITIZATION BOUNDARY TESTS
  // -------------------------------------------------------------
  console.log("\n--- 2. Privacy & Sanitization Boundary ---");

  // 2.1 Hidden test cases and secret fields are stripped from problem
  const dirtyProblem = {
    ...validProblem,
    testCases: [
      { input: "secret_1", expectedOutput: "ans_1", isHidden: true },
      { input: "public_1", expectedOutput: "ans_1", isHidden: false },
    ],
    internalNotes: "secret notes",
    unrelatedUserData: { email: "leak@example.com", password: "hash" },
  };

  const sanitized = validateHintInput({
    problemId: validObjectId,
    language: "cpp",
    code: "test",
    problem: dirtyProblem,
    lastExecutionResult: {
      status: "wrong_answer",
      passedTestCases: 2,
      totalTestCases: 5,
      secretFixture: "HIDDEN_TEST_1",
    },
    userId: "untrusted-user-id",
    jwt: "fake.jwt.token",
  });

  assert.strictEqual(sanitized.problem.testCases, undefined, "testCases must be completely stripped");
  assert.strictEqual(sanitized.problem.internalNotes, undefined, "internalNotes must be stripped");
  assert.strictEqual(sanitized.userId, undefined, "userId on body must be ignored");
  assert.strictEqual(sanitized.jwt, undefined, "jwt on body must be ignored");
  assert.strictEqual(sanitized.lastExecutionResult.secretFixture, undefined, "secret execution fixtures stripped");
  assert.strictEqual(sanitized.lastExecutionResult.status, "wrong_answer");
  pass("2.1 Hidden test cases, credentials, and secret fixtures stripped cleanly");

  // -------------------------------------------------------------
  // 3. SOCRATIC ANTI-SOLUTION OUTPUT VALIDATION TESTS
  // -------------------------------------------------------------
  console.log("\n--- 3. Socratic Anti-Solution Output Validation ---");

  const validRawOutput = {
    hintLevel: "targeted",
    concept: "Hash Map Complement Lookup",
    observation: "Nested loops cause quadratic runtime.",
    suggestedStep: "Store seen numbers in a hash map as you traverse.",
    pitfallToAvoid: "Avoid matching an index with itself.",
    questionToConsider: "How can you check previous values in O(1)?",
  };

  // 3.1 Valid structured hint passes
  const validHint = validateHintOutput(validRawOutput);
  assert.strictEqual(validHint.hintLevel, "targeted");
  assert.strictEqual(validHint.concept, "Hash Map Complement Lookup");
  assert.strictEqual(validHint.questionToConsider, "How can you check previous values in O(1)?");
  pass("3.1 Valid structured Socratic hint output accepted");

  // 3.2 Missing concept rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        concept: undefined,
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.2 Missing 'concept' field rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.3 Missing observation rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        observation: "",
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.3 Empty 'observation' rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.4 Missing suggestedStep rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        suggestedStep: "  ",
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.4 Empty 'suggestedStep' rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.5 Missing pitfallToAvoid rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        pitfallToAvoid: null,
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.5 Missing 'pitfallToAvoid' rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.6 Invalid hintLevel rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        hintLevel: "full_code_dump",
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.6 Invalid hintLevel 'full_code_dump' rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.7 Oversized field length rejected
  assert.throws(
    () => {
      validateHintOutput({
        ...validRawOutput,
        concept: "c".repeat(501),
      });
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.7 Oversized field (> 500 chars) rejected with 502 AI_MALFORMED_RESPONSE");

  // 3.8 Non-object response rejected
  assert.throws(
    () => {
      validateHintOutput("here is your solution");
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("3.8 Raw string / non-object AI response rejected with 502 AI_MALFORMED_RESPONSE");

  // -------------------------------------------------------------
  // 4. SERVICE LAYER & PROVIDER BEHAVIOR TESTS
  // -------------------------------------------------------------
  console.log("\n--- 4. Service Layer & Provider Integration ---");

  // 4.1 MockAiProvider successfully generates hint
  const mockProvider = new MockAiProvider();
  const serviceResult = await generateHint(
    {
      problemId: validObjectId,
      language: "cpp",
      code: "int main() {}",
      problem: validProblem,
    },
    mockProvider
  );
  assert.strictEqual(serviceResult.success, true);
  assert.strictEqual(serviceResult.hint.hintLevel, "targeted");
  assert.strictEqual(mockProvider.callCount, 1);
  pass("4.1 generateHint with MockAiProvider executes and returns valid structure");

  // 4.2 Missing provider rejected
  await assert.rejects(
    async () => {
      await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() {}",
          problem: validProblem,
        },
        null
      );
    },
    (err) => err.statusCode === 503 && err.code === "AI_SERVICE_UNAVAILABLE"
  );
  pass("4.2 Null or unconfigured provider throws 503 AI_SERVICE_UNAVAILABLE");

  // 4.3 Provider unavailable mode maps correctly
  mockProvider.setMode("unavailable");
  await assert.rejects(
    async () => {
      await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() {}",
          problem: validProblem,
        },
        mockProvider
      );
    },
    (err) => err.statusCode === 503 && err.code === "AI_SERVICE_UNAVAILABLE"
  );
  pass("4.3 Provider unavailable mode maps to 503 AI_SERVICE_UNAVAILABLE");

  // 4.4 Provider malformed response maps correctly
  mockProvider.setMode("malformed");
  await assert.rejects(
    async () => {
      await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() {}",
          problem: validProblem,
        },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_MALFORMED_RESPONSE"
  );
  pass("4.4 Provider malformed output maps to 502 AI_MALFORMED_RESPONSE");

  // 4.5 Provider error mode maps correctly
  mockProvider.setMode("error");
  await assert.rejects(
    async () => {
      await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() {}",
          problem: validProblem,
        },
        mockProvider
      );
    },
    (err) => err.statusCode === 502 && err.code === "AI_PROVIDER_ERROR"
  );
  pass("4.5 Provider error mode maps to 502 AI_PROVIDER_ERROR");

  // 4.6 Provider timeout mapping check
  mockProvider.setMode("error");
  const timeoutErr = new Error("Request aborted");
  timeoutErr.code = "AI_TIMEOUT";
  mockProvider.setCustomError(timeoutErr);
  await assert.rejects(
    async () => {
      await generateHint(
        {
          problemId: validObjectId,
          language: "cpp",
          code: "int main() {}",
          problem: validProblem,
        },
        mockProvider
      );
    },
    (err) => err.statusCode === 504 && err.code === "AI_TIMEOUT"
  );
  pass("4.6 Provider timeout maps to 504 AI_TIMEOUT");

  // -------------------------------------------------------------
  // 5. REGRESSION: STAGE 9 AI CODE REVIEW INTACT
  // -------------------------------------------------------------
  console.log("\n--- 5. Stage 9 AI Review Backward Compatibility ---");

  const reviewMock = new MockAiProvider();
  const reviewResult = await reviewCode(
    {
      problemId: validObjectId,
      language: "cpp",
      code: "int main() { return 0; }",
      problem: validProblem,
    },
    reviewMock
  );
  assert.strictEqual(reviewResult.success, true);
  assert.strictEqual(typeof reviewResult.review.summary, "string");
  assert.strictEqual(Array.isArray(reviewResult.review.issues), true);
  pass("5.1 Stage 9 reviewCode() continues working cleanly with unchanged schema");

  console.log(`\n=======================================================`);
  console.log(`🎉 ALL ${passedTests} STAGE 10.1 TESTS PASSED SUCCESSFULLY!`);
  console.log(`=======================================================\n`);
}

runTests().catch((err) => {
  console.error("\n❌ Test failure:", err);
  process.exit(1);
});
