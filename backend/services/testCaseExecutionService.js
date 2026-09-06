const { generateCppHarness } = require("./cppHarnessService");
const executionService = require("./executionService");
const { parseHarnessOutput, compareOutput } = require("./outputComparatorService");

/**
 * Validates problem, code, and testCase metadata for single test case execution.
 * 
 * @param {Object} params
 * @param {Object} params.problem
 * @param {string} params.code
 * @param {Object} params.testCase
 */
function validateTestCaseExecutionInput({ problem, code, testCase }) {
  if (!problem || typeof problem !== "object") {
    throw new Error("Validation Error: problem object is required");
  }

  if (
    !problem.execution ||
    typeof problem.execution.functionName !== "string" ||
    !problem.execution.functionName.trim()
  ) {
    throw new Error("Validation Error: problem.execution.functionName must be a non-empty string");
  }

  if (!Array.isArray(problem.execution.parameters)) {
    throw new Error("Validation Error: problem.execution.parameters must be an array");
  }

  if (!problem.outputComparator || typeof problem.outputComparator !== "string") {
    throw new Error("Validation Error: problem.outputComparator is required");
  }

  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Validation Error: code must be a non-empty string");
  }

  if (!testCase || typeof testCase !== "object" || !testCase.input || typeof testCase.input !== "object") {
    throw new Error("Validation Error: testCase must have a valid input object");
  }

  for (const param of problem.execution.parameters) {
    if (!(param in testCase.input)) {
      throw new Error(`Validation Error: Missing required parameter '${param}' in testCase.input`);
    }
  }
}

/**
 * Executes a single problem test case through the C++ test harness and Piston execution engine,
 * then normalizes and compares the output against the expected result.
 * 
 * Flow:
 * problem + code + testCase
 *   → cppHarnessService.generateCppHarness()
 *   → executionService.execute()
 *   → outputComparatorService.parseHarnessOutput()
 *   → outputComparatorService.compareOutput()
 *   → Normalized test case result
 * 
 * @param {Object} params
 * @param {Object} params.problem - Verified Problem metadata
 * @param {string} params.code - User's C++ Solution source code
 * @param {Object} params.testCase - Test case with input, expectedOutput, isHidden
 * @param {string} [params.language="cpp"] - Target language
 * @param {Object} [params.executionOptions] - Optional execution limits overrides
 * @returns {Promise<{
 *   passed: boolean,
 *   status: "passed" | "wrong_answer" | "compilation_error" | "runtime_error" | "time_limit_exceeded" | "internal_error",
 *   actual: *,
 *   expected: *,
 *   isHidden: boolean,
 *   execution?: {
 *     runtimeMs: number | null,
 *     memoryKb: number | null,
 *     compileTimeMs: number | null
 *   },
 *   error?: string,
 *   diagnostic?: {
 *     compileError?: string,
 *     runtimeError?: string,
 *     signal?: string | null
 *   }
 * }>}
 */
async function executeTestCase({
  problem,
  code,
  testCase,
  language = "cpp",
  executionOptions = {},
}) {
  validateTestCaseExecutionInput({ problem, code, testCase });

  const isHidden = Boolean(testCase.isHidden);
  const expectedOutput = testCase.expectedOutput;

  // 1. Generate compilable C++ standalone harness
  let harnessResult;
  try {
    harnessResult = generateCppHarness({
      solutionCode: code,
      problem,
      testCase,
    });
  } catch (harnessError) {
    return {
      passed: false,
      status: "internal_error",
      actual: null,
      expected: expectedOutput,
      isHidden,
      error: `Harness generation failed: ${harnessError.message}`,
    };
  }

  // 2. Execute harness code through executionService
  let execResult;
  try {
    execResult = await executionService.execute({
      language,
      sourceCode: harnessResult.source,
      compileTimeout: executionOptions.compileTimeout,
      runTimeout: executionOptions.runTimeout,
      compileMemoryLimit: executionOptions.compileMemoryLimit,
      runMemoryLimit: executionOptions.runMemoryLimit,
    });
  } catch (execError) {
    return {
      passed: false,
      status: "internal_error",
      actual: null,
      expected: expectedOutput,
      isHidden,
      error: `Execution invocation failed: ${execError.message}`,
    };
  }

  const executionStats = {
    runtimeMs: execResult.run?.cpuTime ?? null,
    memoryKb: execResult.run?.memory ? Math.round(execResult.run.memory / 1000) : null,
    compileTimeMs: execResult.compile?.cpuTime ?? null,
  };

  // 3. Handle compilation error
  if (execResult.status === "compilation_error") {
    return {
      passed: false,
      status: "compilation_error",
      actual: null,
      expected: expectedOutput,
      isHidden,
      execution: executionStats,
      error: execResult.stderr || execResult.compile?.output || "Compilation failed",
      diagnostic: {
        compileError: execResult.stderr || execResult.compile?.output || null,
        signal: execResult.compile?.signal || null,
      },
    };
  }

  // 4. Handle runtime error
  if (execResult.status === "runtime_error") {
    return {
      passed: false,
      status: "runtime_error",
      actual: null,
      expected: expectedOutput,
      isHidden,
      execution: executionStats,
      error: execResult.stderr || execResult.run?.output || "Runtime error occurred",
      diagnostic: {
        runtimeError: execResult.stderr || execResult.run?.output || null,
        signal: execResult.run?.signal || null,
      },
    };
  }

  // 5. Handle time limit exceeded
  if (execResult.status === "time_limit_exceeded") {
    return {
      passed: false,
      status: "time_limit_exceeded",
      actual: null,
      expected: expectedOutput,
      isHidden,
      execution: executionStats,
      error: "Time limit exceeded",
    };
  }

  // 6. Handle internal error
  if (execResult.status === "internal_error") {
    return {
      passed: false,
      status: "internal_error",
      actual: null,
      expected: expectedOutput,
      isHidden,
      execution: executionStats,
      error: execResult.error || execResult.stderr || "Internal execution failure",
    };
  }

  // 7. Parse stdout and compare output against expected
  const parsedActual = parseHarnessOutput(execResult.stdout);
  const comparison = compareOutput({
    actual: parsedActual,
    expected: expectedOutput,
    comparator: problem.outputComparator || "exact",
  });

  return {
    passed: comparison.passed,
    status: comparison.passed ? "passed" : "wrong_answer",
    actual: parsedActual,
    expected: expectedOutput,
    isHidden,
    execution: executionStats,
  };
}

module.exports = {
  executeTestCase,
  validateTestCaseExecutionInput,
};
