/**
 * Python Test Harness Generator Service for CodeSync AI.
 * 
 * Generates deterministic Python execution source code combining:
 * 1. Standard imports (json, sys, etc.)
 * 2. User's Solution class / function
 * 3. A test runner block that iterates over test cases, serializes inputs/outputs with JSON,
 *    and prints structured output bounded by __CODESYNC_TEST_${i}_START__ / __CODESYNC_TEST_${i}_END__.
 */

function generatePythonMultiTestHarness({ solutionCode, problem, testCases }) {
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

  // Generate a Python snake_case version of the camelCase function name
  // e.g. "twoSum" -> "two_sum", "isPalindrome" -> "is_palindrome"
  const snakeCaseName = functionName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  const hasSnakeFallback = snakeCaseName !== functionName;

  const runnerCode = `
import sys
import json

${solutionCode.trim()}

def __run_codesync_tests():
    test_cases_data = ${testCasesJson}
    try:
        solver = Solution()
    except NameError:
        solver = None

    # Resolve the target method/function once
    fn_name = "${functionName}"
    fn_snake = "${snakeCaseName}"
    target_fn = None

    if solver is not None:
        if hasattr(solver, fn_name):
            target_fn = getattr(solver, fn_name)${hasSnakeFallback ? `
        elif hasattr(solver, fn_snake):
            target_fn = getattr(solver, fn_snake)` : ''}
    if target_fn is None:
        if fn_name in globals():
            target_fn = globals()[fn_name]${hasSnakeFallback ? `
        elif fn_snake in globals():
            target_fn = globals()[fn_snake]` : ''}

    if target_fn is None:
        raise AttributeError(f"Function or method '{fn_name}'${hasSnakeFallback ? ` (or '{fn_snake}')` : ''} not found in Solution class or module scope")

    for i, tc_args in enumerate(test_cases_data):
        sys.stdout.write(f"__CODESYNC_TEST_{i}_START__\\n")
        sys.stdout.flush()
        
        args = [tc_args[p] for p in ${JSON.stringify(parameters)}]
        res = target_fn(*args)
            
        sys.stdout.write(json.dumps(res) + "\\n")
        sys.stdout.write(f"__CODESYNC_TEST_{i}_END__\\n")
        sys.stdout.flush()

if __name__ == "__main__":
    __run_codesync_tests()
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
  generatePythonMultiTestHarness,
};
