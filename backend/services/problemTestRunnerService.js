const { executeTestCase } = require("./testCaseExecutionService");
const {
  isEligibleForUnifiedExecution: isEligibleCppUnifiedExecution,
  generateCppMultiTestHarness,
  parseMultiTestHarnessOutput,
} = require("./cppMultiTestHarnessService");
const { generatePythonMultiTestHarness } = require("./languageRunners/pythonHarnessService");
const { generateJavascriptMultiTestHarness } = require("./languageRunners/javascriptHarnessService");
const { generateJavaMultiTestHarness } = require("./languageRunners/javaHarnessService");
const executionService = require("./executionService");
const { compareOutput } = require("./outputComparatorService");

/**
 * Checks whether a problem & language can run in unified multi-test execution mode.
 * 
 * @param {Object} problem
 * @param {string} language
 * @returns {boolean}
 */
function isEligibleForUnifiedExecution(problem, language) {
  const normLang = (language || "cpp").toLowerCase();
  if (normLang === "cpp" || normLang === "c++") {
    return isEligibleCppUnifiedExecution(problem, language);
  }
  if (["python", "py", "python3", "javascript", "js", "node", "java"].includes(normLang)) {
    return Boolean(
      problem &&
      problem.execution &&
      typeof problem.execution.functionName === "string" &&
      Array.isArray(problem.execution.parameters) &&
      Array.isArray(problem.testCases) &&
      problem.testCases.length > 0
    );
  }
  return false;
}

/**
 * Generates the appropriate unified multi-test harness for the target language.
 */
function generateLanguageMultiTestHarness({ solutionCode, problem, testCases, language }) {
  const normLang = (language || "cpp").toLowerCase();
  if (normLang === "python" || normLang === "py" || normLang === "python3") {
    return generatePythonMultiTestHarness({ solutionCode, problem, testCases });
  }
  if (normLang === "javascript" || normLang === "js" || normLang === "node") {
    return generateJavascriptMultiTestHarness({ solutionCode, problem, testCases });
  }
  if (normLang === "java") {
    return generateJavaMultiTestHarness({ solutionCode, problem, testCases });
  }
  // Default to C++
  return generateCppMultiTestHarness({ solutionCode, problem, testCases });
}

/**
 * Validates the inputs required to run a multi-test problem suite.
 * 
 * @param {Object} params
 * @param {Object} params.problem
 * @param {string} params.code
 */
function validateRunProblemInput({ problem, code }) {
  if (!problem || typeof problem !== "object") {
    throw new Error("Validation Error: problem object is required");
  }

  if (typeof code !== "string" || !code.trim()) {
    throw new Error("Validation Error: code must be a non-empty string");
  }

  if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
    throw new Error("Validation Error: problem must have a non-empty testCases array");
  }
}

/**
 * Sanitizes a single test case result to ensure hidden test details are never leaked.
 * 
 * @param {Object} result - Raw internal test case execution result
 * @param {number} testIndex - 0-indexed position
 * @param {Object} originalTestCase - The problem testCase object
 * @returns {Object} Safe test result object
 */
function sanitizeTestResult(result, testIndex, originalTestCase) {
  const isHidden = Boolean(originalTestCase.isHidden);

  if (isHidden) {
    return {
      testCaseIndex: testIndex,
      passed: result.passed,
      status: result.status,
      isHidden: true,
      executionTimeMs: result.execution?.runtimeMs ?? null,
      memoryKb: result.execution?.memoryKb ?? null,
    };
  }

  return {
    testCaseIndex: testIndex,
    passed: result.passed,
    status: result.status,
    isHidden: false,
    input: originalTestCase.input,
    expectedOutput: originalTestCase.expectedOutput,
    actualOutput: result.actual,
    executionTimeMs: result.execution?.runtimeMs ?? null,
    memoryKb: result.execution?.memoryKb ?? null,
    errorMessage: result.error ?? null,
  };
}

/**
 * Executes problem test cases using the unified single-compilation multi-test harness.
 * 
 * @param {Object} params
 * @param {Object} params.problem
 * @param {string} params.code
 * @param {Array<{ tc: Object, originalIndex: number }>} params.selectedTestCases
 * @param {string} params.language
 * @returns {Promise<Object>}
 */
async function runUnifiedMultiTestProblem({
  problem,
  code,
  selectedTestCases,
  language = "cpp",
}) {
  const totalTestCases = selectedTestCases.length;
  const rawTestCases = selectedTestCases.map(({ tc }) => tc);

  // 1. Generate unified harness for all selected test cases in target language
  const harnessResult = generateLanguageMultiTestHarness({
    solutionCode: code,
    problem,
    testCases: rawTestCases,
    language,
  });

  // 2. Execute once via Piston with language-appropriate timeouts
  // C++ requires GCC compilation which is slower; interpreted languages skip compile step
  const timeoutConfig = {};
  const normLang = (language || "cpp").toLowerCase();
  if (normLang === "cpp" || normLang === "c++") {
    // GCC compilation is inherently slow on low-RAM hardware (25-30s with STL headers)
    // -O0 disables optimization passes, reducing CPU time and memory pressure from ~200MB
    // Don't restrict compile time — let Piston use its default
    timeoutConfig.compileArgs = ["-O0"];
    timeoutConfig.runTimeout = 3000;     // 3s max for execution (Piston ceiling)
  } else if (normLang === "java") {
    timeoutConfig.compileTimeout = 10000; // 10s for javac
    timeoutConfig.runTimeout = 3000;     // 3s max for execution (Piston ceiling)
  } else {
    // Python, JavaScript — interpreted, no compile step
    timeoutConfig.runTimeout = 3000;     // 3s max for execution (Piston ceiling)
  }

  const execResult = await executionService.execute({
    language,
    sourceCode: harnessResult.source,
    ...timeoutConfig,
  });


  const execRuntimeMs = execResult.run?.cpuTime ?? 0;
  const execMemoryKb = execResult.run?.memory ? Math.round(execResult.run.memory / 1000) : 0;

  // 4. Handle compilation errors
  if (execResult.status === "compilation_error") {
    const compileErrorMsg = execResult.stderr || execResult.compile?.output || "Compilation failed";
    const { tc, originalIndex } = selectedTestCases[0];
    const compileResultObj = {
      passed: false,
      status: "compilation_error",
      actual: null,
      expected: tc.expectedOutput,
      isHidden: Boolean(tc.isHidden),
      error: compileErrorMsg,
      execution: { runtimeMs: 0, memoryKb: 0 },
    };

    return {
      status: "compilation_error",
      passedTestCases: 0,
      totalTestCases,
      runtimeMs: 0,
      memoryKb: 0,
      testResults: [sanitizeTestResult(compileResultObj, originalIndex, tc)],
      failedTestCase: {
        testCaseIndex: originalIndex,
        status: "compilation_error",
        error: compileErrorMsg,
      },
      error: compileErrorMsg,
    };
  }

  // 5. Parse structured multi-test output
  const parsedHarness = parseMultiTestHarnessOutput(
    execResult.stdout || execResult.run?.stdout || "",
    totalTestCases
  );

  // 6. Handle timeout or runtime crash during execution
  if (execResult.status === "time_limit_exceeded") {
    const timedOutIdx = parsedHarness.lastCompletedIndex + 1;
    const effectiveIdx = Math.min(timedOutIdx, totalTestCases - 1);
    const { tc, originalIndex } = selectedTestCases[effectiveIdx];

    const timeoutResultObj = {
      passed: false,
      status: "time_limit_exceeded",
      actual: null,
      expected: tc.expectedOutput,
      isHidden: Boolean(tc.isHidden),
      error: "Time limit exceeded",
      execution: { runtimeMs: execRuntimeMs, memoryKb: execMemoryKb },
    };

    return {
      status: "time_limit_exceeded",
      passedTestCases: parsedHarness.lastCompletedIndex >= 0 ? parsedHarness.lastCompletedIndex + 1 : 0,
      totalTestCases,
      runtimeMs: execRuntimeMs,
      memoryKb: execMemoryKb,
      testResults: [sanitizeTestResult(timeoutResultObj, originalIndex, tc)],
      failedTestCase: tc.isHidden
        ? { testCaseIndex: originalIndex, isHidden: true, status: "time_limit_exceeded" }
        : { testCaseIndex: originalIndex, status: "time_limit_exceeded", error: "Time limit exceeded" },
      error: "Time limit exceeded",
    };
  }

  if (execResult.status === "runtime_error" || (!parsedHarness.success && execResult.status !== "success")) {
    const crashedIdx = parsedHarness.lastCompletedIndex + 1;
    const effectiveIdx = Math.min(crashedIdx, totalTestCases - 1);
    const { tc, originalIndex } = selectedTestCases[effectiveIdx];
    const runtimeErrorMsg = execResult.stderr || execResult.run?.output || "Runtime error occurred";

    const runtimeResultObj = {
      passed: false,
      status: "runtime_error",
      actual: null,
      expected: tc.expectedOutput,
      isHidden: Boolean(tc.isHidden),
      error: runtimeErrorMsg,
      execution: { runtimeMs: execRuntimeMs, memoryKb: execMemoryKb },
    };

    return {
      status: "runtime_error",
      passedTestCases: parsedHarness.lastCompletedIndex >= 0 ? parsedHarness.lastCompletedIndex + 1 : 0,
      totalTestCases,
      runtimeMs: execRuntimeMs,
      memoryKb: execMemoryKb,
      testResults: [sanitizeTestResult(runtimeResultObj, originalIndex, tc)],
      failedTestCase: tc.isHidden
        ? { testCaseIndex: originalIndex, isHidden: true, status: "runtime_error" }
        : {
            testCaseIndex: originalIndex,
            input: tc.input,
            expected: tc.expectedOutput,
            status: "runtime_error",
            error: runtimeErrorMsg,
          },
      error: runtimeErrorMsg,
    };
  }

  // 7. Evaluate each test output against expected output using outputComparatorService
  const testResults = [];
  let passedTestCases = 0;
  let finalStatus = "accepted";
  let failedTestCase = null;
  let primaryError = null;

  for (let i = 0; i < totalTestCases; i++) {
    const { tc, originalIndex } = selectedTestCases[i];
    const testOut = parsedHarness.testOutputs[i];
    const actualVal = testOut ? testOut.parsedValue : null;

    const compResult = compareOutput({
      actual: actualVal,
      expected: tc.expectedOutput,
      comparator: problem.outputComparator || "exact",
    });

    const singleResult = {
      passed: compResult.passed,
      status: compResult.passed ? "passed" : "wrong_answer",
      actual: actualVal,
      expected: tc.expectedOutput,
      isHidden: Boolean(tc.isHidden),
      execution: {
        runtimeMs: Math.round(execRuntimeMs / totalTestCases),
        memoryKb: execMemoryKb,
      },
    };

    const safeResult = sanitizeTestResult(singleResult, originalIndex, tc);
    testResults.push(safeResult);

    if (compResult.passed) {
      passedTestCases++;
    } else {
      // First failed test determines the verdict
      finalStatus = "wrong_answer";
      if (!tc.isHidden) {
        failedTestCase = {
          testCaseIndex: originalIndex,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: actualVal,
          status: "wrong_answer",
          error: null,
        };
      } else {
        failedTestCase = {
          testCaseIndex: originalIndex,
          isHidden: true,
          status: "wrong_answer",
        };
      }
      break;
    }
  }

  return {
    status: finalStatus,
    passedTestCases,
    totalTestCases,
    runtimeMs: execRuntimeMs,
    memoryKb: execMemoryKb,
    testResults,
    failedTestCase,
    error: primaryError,
  };
}

/**
 * Executes problem test cases sequentially with early fail-fast termination (Legacy fallback path).
 * 
 * @param {Object} params
 * @returns {Promise<Object>}
 */
async function runLegacySequentialProblem({
  problem,
  code,
  selectedTestCases,
  language = "cpp",
  executionOptions = {},
}) {
  const totalTestCases = selectedTestCases.length;
  const testResults = [];

  let passedTestCases = 0;
  let aggregateRuntimeMs = 0;
  let maxMemoryKb = 0;
  let finalStatus = "accepted";
  let failedTestCase = null;
  let primaryError = null;

  for (let i = 0; i < selectedTestCases.length; i++) {
    const { tc, originalIndex } = selectedTestCases[i];

    const result = await executeTestCase({
      problem,
      code,
      testCase: tc,
      language,
      executionOptions,
    });

    if (typeof result.execution?.runtimeMs === "number") {
      aggregateRuntimeMs += result.execution.runtimeMs;
    }
    if (typeof result.execution?.memoryKb === "number" && result.execution.memoryKb > maxMemoryKb) {
      maxMemoryKb = result.execution.memoryKb;
    }

    const safeResult = sanitizeTestResult(result, originalIndex, tc);
    testResults.push(safeResult);

    if (result.passed && result.status === "passed") {
      passedTestCases++;
    } else {
      finalStatus = result.status;
      primaryError = result.error || null;

      if (!tc.isHidden) {
        failedTestCase = {
          testCaseIndex: originalIndex,
          input: tc.input,
          expected: tc.expectedOutput,
          actual: result.actual,
          status: result.status,
          error: result.error ?? null,
        };
      } else {
        failedTestCase = {
          testCaseIndex: originalIndex,
          isHidden: true,
          status: result.status,
        };
      }
      break;
    }
  }

  return {
    status: finalStatus,
    passedTestCases,
    totalTestCases,
    runtimeMs: aggregateRuntimeMs,
    memoryKb: maxMemoryKb,
    testResults,
    failedTestCase,
    error: primaryError,
  };
}

/**
 * Unified problem execution runner for CodeSync AI.
 * Routes eligible C++ requests through the unified single-compilation multi-test harness,
 * and maintains the legacy single-test executor as a pre-execution fallback for unsupported types/languages.
 * 
 * @param {Object} params
 * @param {Object} params.problem - Authoritative Problem document
 * @param {string} params.code - User's C++ Solution class implementation
 * @param {boolean} [params.includeHidden=false] - When true, runs both visible & hidden test cases; when false, visible only
 * @param {string} [params.language="cpp"] - Target programming language
 * @param {Object} [params.executionOptions] - Optional compiler/runner timeout & memory overrides
 * @returns {Promise<Object>}
 */
async function runProblem({
  problem,
  code,
  includeHidden = false,
  language = "cpp",
  executionOptions = {},
}) {
  validateRunProblemInput({ problem, code });

  // Filter test cases based on includeHidden flag while preserving array ordering
  const selectedTestCases = problem.testCases
    .map((tc, originalIndex) => ({ tc, originalIndex }))
    .filter(({ tc }) => includeHidden || !tc.isHidden);

  // Pre-execution eligibility check
  if (isEligibleForUnifiedExecution(problem, language)) {
    return runUnifiedMultiTestProblem({
      problem,
      code,
      selectedTestCases,
      language,
    });
  }

  // Pre-execution fallback to legacy path for unsupported problems/languages
  return runLegacySequentialProblem({
    problem,
    code,
    selectedTestCases,
    language,
    executionOptions,
  });
}

module.exports = {
  runProblem,
  runUnifiedMultiTestProblem,
  runLegacySequentialProblem,
  validateRunProblemInput,
  sanitizeTestResult,
};

