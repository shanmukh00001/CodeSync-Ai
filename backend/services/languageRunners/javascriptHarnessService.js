/**
 * JavaScript / Node.js Test Harness Generator Service for CodeSync AI.
 * 
 * Generates deterministic Node.js execution source code combining:
 * 1. User's Solution class or standalone function
 * 2. A test runner block that iterates over test cases, executes the target method,
 *    and prints JSON serialized outputs bounded by __CODESYNC_TEST_${i}_START__ / __CODESYNC_TEST_${i}_END__.
 */

function generateJavascriptMultiTestHarness({ solutionCode, problem, testCases }) {
  if (typeof solutionCode !== "string" || !solutionCode.trim()) {
    throw new Error("Validation Error: solutionCode must be a non-empty string");
  }

  if (!problem || typeof problem !== "object") {
    throw new Error("Validation Error: problem object is required");
  }

  if (!Array.isArray(testCases) || testCases.length === 0) {
    throw new Error("Validation Error: testCases must be a non-empty array");
  }

  const { functionName, parameters } = problem.execution;

  const testCasesJson = JSON.stringify(
    testCases.map((tc) => {
      const args = {};
      for (const p of parameters) {
        args[p] = tc.input[p];
      }
      return args;
    })
  );

  const runnerCode = `
${solutionCode.trim()}

function __run_codesync_tests() {
  const testCasesData = ${testCasesJson};
  let solverInstance = null;
  
  try {
    if (typeof Solution === "function") {
      solverInstance = new Solution();
    }
  } catch (e) {}

  for (let i = 0; i < testCasesData.length; i++) {
    process.stdout.write("__CODESYNC_TEST_" + i + "_START__\\n");
    const tcArgs = testCasesData[i];
    const args = ${JSON.stringify(parameters)}.map(p => tcArgs[p]);

    let res;
    if (solverInstance && typeof solverInstance["${functionName}"] === "function") {
      res = solverInstance["${functionName}"](...args);
    } else if (typeof global["${functionName}"] === "function") {
      res = global["${functionName}"](...args);
    } else if (typeof eval("${functionName}") === "function") {
      res = eval("${functionName}")(...args);
    } else {
      throw new Error("Function '${functionName}' not found in Solution or global scope");
    }

    process.stdout.write(JSON.stringify(res !== undefined ? res : null) + "\\n");
    process.stdout.write("__CODESYNC_TEST_" + i + "_END__\\n");
  }
}

try {
  __run_codesync_tests();
} catch (err) {
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}
`;

  return {
    source: runnerCode.trim(),
    metadata: {
      problemSlug: problem.slug || null,
      functionName,
      parameters: [...parameters],
      testCaseCount: testCases.length,
      comparator: problem.outputComparator || "exact",
    },
  };
}

module.exports = {
  generateJavascriptMultiTestHarness,
};
