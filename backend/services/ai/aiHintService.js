const mongoose = require("mongoose");
const { AppError } = require("../../middleware/errorMiddleware");
const AIProvider = require("./aiProvider");

const ALLOWED_LANGUAGES = ["cpp", "javascript", "python", "java"];
const ALLOWED_HINT_LEVELS = ["gentle", "targeted", "refinement"];

const MAX_CODE_LENGTH = 65536;
const MAX_FIELD_LENGTH = 500;

/**
 * Validates and normalizes client hint request inputs.
 * Strictly prevents hidden test data, passwords, or unrelated fields from entering the hint pipeline.
 *
 * @param {Object} rawInput
 * @returns {Object} sanitizedInput
 */
function validateHintInput(rawInput) {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new AppError("Invalid hint request payload", 400, "AI_INVALID_INPUT");
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

  // 3. code validation (optional or empty string allowed, but if present must be string <= MAX_CODE_LENGTH)
  if (code === undefined || code === null) {
    throw new AppError("Code is required", 400, "AI_INVALID_INPUT");
  }
  if (typeof code !== "string") {
    throw new AppError("Code must be a string", 400, "AI_INVALID_INPUT");
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
  if (lastExecutionResult !== undefined && lastExecutionResult !== null) {
    if (typeof lastExecutionResult !== "object" || Array.isArray(lastExecutionResult)) {
      throw new AppError("lastExecutionResult must be an object", 400, "AI_INVALID_INPUT");
    }

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
  if (!problem || typeof problem !== "object" || Array.isArray(problem)) {
    throw new AppError("problem object is required", 400, "AI_INVALID_INPUT");
  }

  const sanitizedProblem = {
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
 * Validates structured AI hint output against the Stage 10 contract.
 * Strictly enforces anti-solution behavior, requiring Socratic guidance fields and valid bounds.
 *
 * @param {Object} rawOutput
 * @returns {Object} normalizedHint
 */
function validateHintOutput(rawOutput) {
  if (!rawOutput || typeof rawOutput !== "object" || Array.isArray(rawOutput)) {
    throw new AppError(
      "AI provider returned an empty or non-object response",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  const {
    hintLevel = "targeted",
    concept,
    observation,
    suggestedStep,
    pitfallToAvoid,
    questionToConsider,
  } = rawOutput;

  // 1. hintLevel validation
  const normalizedLevel = String(hintLevel).toLowerCase().trim();
  if (!ALLOWED_HINT_LEVELS.includes(normalizedLevel)) {
    throw new AppError(
      `Invalid hintLevel '${hintLevel}'. Allowed values are: ${ALLOWED_HINT_LEVELS.join(", ")}`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 2. concept validation (required string)
  if (typeof concept !== "string" || !concept.trim()) {
    throw new AppError(
      "AI hint output missing required 'concept' string",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  if (concept.length > MAX_FIELD_LENGTH) {
    throw new AppError(
      `AI hint concept exceeds maximum length of ${MAX_FIELD_LENGTH} characters`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 3. observation validation (required string)
  if (typeof observation !== "string" || !observation.trim()) {
    throw new AppError(
      "AI hint output missing required 'observation' string",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  if (observation.length > MAX_FIELD_LENGTH) {
    throw new AppError(
      `AI hint observation exceeds maximum length of ${MAX_FIELD_LENGTH} characters`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 4. suggestedStep validation (required string)
  if (typeof suggestedStep !== "string" || !suggestedStep.trim()) {
    throw new AppError(
      "AI hint output missing required 'suggestedStep' string",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  if (suggestedStep.length > MAX_FIELD_LENGTH) {
    throw new AppError(
      `AI hint suggestedStep exceeds maximum length of ${MAX_FIELD_LENGTH} characters`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 5. pitfallToAvoid validation (required string)
  if (typeof pitfallToAvoid !== "string" || !pitfallToAvoid.trim()) {
    throw new AppError(
      "AI hint output missing required 'pitfallToAvoid' string",
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }
  if (pitfallToAvoid.length > MAX_FIELD_LENGTH) {
    throw new AppError(
      `AI hint pitfallToAvoid exceeds maximum length of ${MAX_FIELD_LENGTH} characters`,
      502,
      "AI_MALFORMED_RESPONSE"
    );
  }

  // 6. questionToConsider validation (optional string)
  let validatedQuestion = undefined;
  if (questionToConsider !== undefined && questionToConsider !== null) {
    if (typeof questionToConsider !== "string" || !questionToConsider.trim()) {
      throw new AppError(
        "AI hint 'questionToConsider' must be a non-empty string when provided",
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }
    if (questionToConsider.length > MAX_FIELD_LENGTH) {
      throw new AppError(
        `AI hint questionToConsider exceeds maximum length of ${MAX_FIELD_LENGTH} characters`,
        502,
        "AI_MALFORMED_RESPONSE"
      );
    }
    validatedQuestion = questionToConsider.trim();
  }

  return {
    hintLevel: normalizedLevel,
    concept: concept.trim(),
    observation: observation.trim(),
    suggestedStep: suggestedStep.trim(),
    pitfallToAvoid: pitfallToAvoid.trim(),
    ...(validatedQuestion ? { questionToConsider: validatedQuestion } : {}),
  };
}

/**
 * Service function to generate a Socratic AI hint through a decoupled AI provider.
 *
 * @param {Object} rawInput - User/Room submission and problem context
 * @param {AIProvider} [provider] - Injected provider instance
 * @returns {Promise<{ success: boolean, hint: Object }>}
 */
async function generateHint(rawInput, provider) {
  if (!provider || !(provider instanceof AIProvider)) {
    throw new AppError("AI provider not configured or invalid", 503, "AI_SERVICE_UNAVAILABLE");
  }

  // 1. Validate & sanitize input
  const sanitizedInput = validateHintInput(rawInput);

  // 2. Invoke provider
  let rawHintOutput;
  try {
    rawHintOutput = await provider.generateHint(sanitizedInput);
  } catch (err) {
    if (err.code === "SERVICE_UNAVAILABLE" || err.statusCode === 503) {
      throw new AppError("AI hint service is temporarily unavailable", 503, "AI_SERVICE_UNAVAILABLE");
    }
    if (err.code === "AI_TIMEOUT" || err.statusCode === 504 || err.name === "AbortError") {
      throw new AppError("AI hint request timed out", 504, "AI_TIMEOUT");
    }
    if (err.code === "AI_RATE_LIMIT" || err.statusCode === 429) {
      throw new AppError("AI hint rate limit reached. Please wait before retrying.", 429, "AI_RATE_LIMIT");
    }
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(
      err.message || "AI provider encountered an error generating hint",
      502,
      "AI_PROVIDER_ERROR"
    );
  }

  // 3. Validate & normalize provider output
  const validatedHint = validateHintOutput(rawHintOutput);

  return {
    success: true,
    hint: validatedHint,
  };
}

module.exports = {
  generateHint,
  validateHintInput,
  validateHintOutput,
  ALLOWED_LANGUAGES,
  ALLOWED_HINT_LEVELS,
  MAX_CODE_LENGTH,
  MAX_FIELD_LENGTH,
};
