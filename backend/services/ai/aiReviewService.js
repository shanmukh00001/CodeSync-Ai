const mongoose = require("mongoose");
const { AppError } = require("../../middleware/errorMiddleware");
const AIProvider = require("./aiProvider");

const ALLOWED_LANGUAGES = ["cpp", "javascript", "python", "java"];
const ALLOWED_SEVERITIES = ["critical", "high", "medium", "low", "info"];
const ALLOWED_CATEGORIES = [
  "correctness",
  "performance",
  "edge_case",
  "code_quality",
  "security",
  "idiomatic_style",
];

const MAX_CODE_LENGTH = 65536;
const MAX_SUMMARY_LENGTH = 300;

/**
 * Validates and normalizes client review request inputs.
 * Strictly prevents hidden test data, passwords, or unrelated fields from entering the review pipeline.
 *
 * @param {Object} rawInput
 * @returns {Object} sanitizedInput
 */
function validateReviewInput(rawInput) {
  if (!rawInput || typeof rawInput !== "object") {
    throw new AppError("Invalid review request payload", 400, "AI_INVALID_INPUT");
  }

  const { problemId, language, code, roomId, lastExecutionResult, problem } = rawInput;

  // 1. problemId validation
  if (!problemId) {
    throw new AppError("problemId is required", 400, "AI_INVALID_INPUT");
  }
  if (!mongoose.Types.ObjectId.isValid(problemId)) {
    throw new AppError("Invalid problemId format", 400, "AI_INVALID_INPUT");
  }

  // 2. language validation
  if (!language || typeof language !== "string") {
    throw new AppError("language is required", 400, "AI_INVALID_INPUT");
  }
  const normalizedLanguage = language.trim().toLowerCase();
  if (!ALLOWED_LANGUAGES.includes(normalizedLanguage)) {
    throw new AppError(
      `Unsupported language: ${language}. Allowed languages are: ${ALLOWED_LANGUAGES.join(", ")}`,
      400,
      "AI_INVALID_INPUT"
    );
  }

  // 3. code validation
  if (typeof code !== "string" || code.trim().length === 0) {
    throw new AppError("Code is required and cannot be empty", 400, "AI_INVALID_INPUT");
  }
  if (code.length > MAX_CODE_LENGTH) {
    throw new AppError(
      `Code length exceeds maximum allowed limit of ${MAX_CODE_LENGTH} characters`,
      400,
      "AI_INVALID_INPUT"
    );
  }

  // 4. roomId validation (optional)
  let normalizedRoomId = null;
  if (roomId !== undefined && roomId !== null) {
    if (typeof roomId !== "string" || roomId.trim().length === 0) {
      throw new AppError("Invalid roomId format", 400, "AI_INVALID_INPUT");
    }
    normalizedRoomId = roomId.trim();
  }

  // 5. lastExecutionResult validation (optional, strictly filtered to public fields)
  let sanitizedExecution = null;
  if (lastExecutionResult && typeof lastExecutionResult === "object") {
    // Whitelist only public metadata fields; reject secret test fixtures
    sanitizedExecution = {
      status: typeof lastExecutionResult.status === "string" ? lastExecutionResult.status : undefined,
      passedTestCases:
        typeof lastExecutionResult.passedTestCases === "number"
          ? lastExecutionResult.passedTestCases
          : undefined,
      totalTestCases:
        typeof lastExecutionResult.totalTestCases === "number"
          ? lastExecutionResult.totalTestCases
          : undefined,
      runtimeMs:
        typeof lastExecutionResult.runtimeMs === "number"
          ? lastExecutionResult.runtimeMs
          : undefined,
      memoryKb:
        typeof lastExecutionResult.memoryKb === "number"
          ? lastExecutionResult.memoryKb
          : undefined,
    };
  }

  // 6. Problem context sanitization (whitelisted public attributes only)
  let sanitizedProblem = null;
  if (problem && typeof problem === "object") {
    sanitizedProblem = {
      title: typeof problem.title === "string" ? problem.title : "Untitled Problem",
      description: typeof problem.description === "string" ? problem.description : "",
      difficulty: typeof problem.difficulty === "string" ? problem.difficulty : "Medium",
      constraints: Array.isArray(problem.constraints) ? problem.constraints : [],
      examples: Array.isArray(problem.examples)
        ? problem.examples.map((ex) => ({
            input: String(ex.input || ""),
            output: String(ex.output || ""),
            explanation: ex.explanation ? String(ex.explanation) : undefined,
          }))
        : [],
    };
  }

  return {
    problemId: String(problemId),
    language: normalizedLanguage,
    code,
    roomId: normalizedRoomId,
    lastExecutionResult: sanitizedExecution,
    problem: sanitizedProblem,
  };
}

/**
 * Validates structured AI review output against the Stage 9.0 contract.
 *
 * @param {Object} rawOutput
 * @returns {Object} normalizedReview
 */
function validateReviewOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    throw new AppError(
      "AI provider returned an empty or non-object response",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  const {
    summary,
    verdictAssessment,
    issues,
    strengths,
    actionableSuggestions,
  } = rawOutput;

  // 1. Summary validation
  if (typeof summary !== "string" || summary.trim().length === 0) {
    throw new AppError(
      "AI review output missing 'summary' string",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  if (summary.length > MAX_SUMMARY_LENGTH) {
    throw new AppError(
      `AI review summary exceeds ${MAX_SUMMARY_LENGTH} characters`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 2. VerdictAssessment validation
  if (!verdictAssessment || typeof verdictAssessment !== "object" || Array.isArray(verdictAssessment)) {
    throw new AppError(
      "AI review output missing 'verdictAssessment' object",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  const {
    executionAlignment,
    timeComplexity,
    spaceComplexity,
    complexityAnalysis,
  } = verdictAssessment;

  if (
    typeof executionAlignment !== "string" ||
    typeof timeComplexity !== "string" ||
    typeof spaceComplexity !== "string" ||
    typeof complexityAnalysis !== "string"
  ) {
    throw new AppError(
      "AI review verdictAssessment contains invalid or missing complexity fields",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 3. Issues array validation
  if (!Array.isArray(issues)) {
    throw new AppError(
      "AI review output 'issues' must be an array",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  const validatedIssues = issues.map((issue, idx) => {
    if (!issue || typeof issue !== "object") {
      throw new AppError(
        `Issue at index ${idx} is not an object`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    const {
      id = `issue-${idx + 1}`,
      category,
      severity,
      title,
      lineRange,
      explanation,
      recommendation,
    } = issue;

    if (!category || !ALLOWED_CATEGORIES.includes(String(category).toLowerCase())) {
      throw new AppError(
        `Invalid issue category '${category}' at index ${idx}. Allowed: ${ALLOWED_CATEGORIES.join(", ")}`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    if (!severity || !ALLOWED_SEVERITIES.includes(String(severity).toLowerCase())) {
      throw new AppError(
        `Invalid issue severity '${severity}' at index ${idx}. Allowed: ${ALLOWED_SEVERITIES.join(", ")}`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    if (typeof title !== "string" || !title.trim()) {
      throw new AppError(
        `Issue at index ${idx} missing valid 'title'`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    if (typeof explanation !== "string" || !explanation.trim()) {
      throw new AppError(
        `Issue at index ${idx} missing valid 'explanation'`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    if (typeof recommendation !== "string" || !recommendation.trim()) {
      throw new AppError(
        `Issue at index ${idx} missing valid 'recommendation'`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }

    // lineRange validation (nullable or object with start/end integers >= 1)
    let validatedLineRange = null;
    if (lineRange && typeof lineRange === "object") {
      const start = Number(lineRange.start);
      const end = Number(lineRange.end);
      if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= start) {
        validatedLineRange = { start, end };
      } else {
        throw new AppError(
          `Issue at index ${idx} has malformed lineRange. Expected { start: int >= 1, end: int >= start }`,
          502,
          "AI_MALFORMED_RESPONSE"
        );
      }
    }

    return {
      id: String(id),
      category: String(category).toLowerCase(),
      severity: String(severity).toLowerCase(),
      title: String(title).trim(),
      lineRange: validatedLineRange,
      explanation: String(explanation).trim(),
      recommendation: String(recommendation).trim(),
    };
  });

  // 4. Strengths array validation (1 to 5 items)
  if (!Array.isArray(strengths) || strengths.length < 1 || strengths.length > 5) {
    throw new AppError(
      "AI review output 'strengths' must be an array containing between 1 and 5 items",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  const validatedStrengths = strengths.map((s, idx) => {
    if (typeof s !== "string" || !s.trim()) {
      throw new AppError(
        `Strength at index ${idx} must be a non-empty string`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }
    return s.trim();
  });

  // 5. ActionableSuggestions array validation (1 to 5 items)
  if (
    !Array.isArray(actionableSuggestions) ||
    actionableSuggestions.length < 1 ||
    actionableSuggestions.length > 5
  ) {
    throw new AppError(
      "AI review output 'actionableSuggestions' must be an array containing between 1 and 5 items",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  const validatedSuggestions = actionableSuggestions.map((s, idx) => {
    if (typeof s !== "string" || !s.trim()) {
      throw new AppError(
        `Actionable suggestion at index ${idx} must be a non-empty string`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }
    return s.trim();
  });

  return {
    summary: summary.trim(),
    verdictAssessment: {
      executionAlignment: executionAlignment.trim(),
      timeComplexity: timeComplexity.trim(),
      spaceComplexity: spaceComplexity.trim(),
      complexityAnalysis: complexityAnalysis.trim(),
    },
    issues: validatedIssues,
    strengths: validatedStrengths,
    actionableSuggestions: validatedSuggestions,
  };
}

/**
 * Service function to review code through a decoupled AI provider.
 *
 * @param {Object} rawInput - User/Room submission context
 * @param {AIProvider} [provider] - Injected provider (defaults to Mock or configured provider)
 * @returns {Promise<{ success: boolean, review: Object }>}
 */
async function reviewCode(rawInput, provider) {
  if (!provider || !(provider instanceof AIProvider)) {
    throw new AppError("AI provider not configured or invalid", 503, "AI_SERVICE_UNAVAILABLE");
  }

  // 1. Validate & sanitize input
  const sanitizedInput = validateReviewInput(rawInput);

  // 2. Invoke provider
  let rawReviewOutput;
  try {
    rawReviewOutput = await provider.reviewCode(sanitizedInput);
  } catch (err) {
    if (err.code === "SERVICE_UNAVAILABLE" || err.statusCode === 503) {
      throw new AppError("AI review service is temporarily unavailable", 503, "AI_SERVICE_UNAVAILABLE");
    }
    throw new AppError(
      err.message || "AI provider encountered an error",
      502,
      "AI_PROVIDER_ERROR"
    );
  }

  // 3. Validate & normalize provider output
  const validatedReview = validateReviewOutput(rawReviewOutput);

  return {
    success: true,
    review: validatedReview,
  };
}

module.exports = {
  reviewCode,
  validateReviewInput,
  validateReviewOutput,
  ALLOWED_LANGUAGES,
  ALLOWED_SEVERITIES,
  ALLOWED_CATEGORIES,
};
