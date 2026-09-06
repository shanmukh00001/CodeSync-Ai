const {
  inferCppType,
  formatCppValue,
  validateHarnessInput,
} = require("./cppHarnessService");
const { parseHarnessOutput } = require("./outputComparatorService");

/**
 * Common C++ headers and serialization helpers for multi-test harness.
 */
const CPP_COMMON_HEADERS_AND_SERIALIZERS = `#include <bits/stdc++.h>

using namespace std;

// Forward declaration of serializers
void print_result(bool val);
void print_result(int val);
void print_result(long long val);
void print_result(double val);
void print_result(const string& val);
void print_result(const char* val);

template <typename T>
void print_result(const vector<T>& vec);

void print_result(bool val) {
    cout << (val ? "true" : "false");
}

void print_result(int val) {
    cout << val;
}

void print_result(long long val) {
    cout << val;
}

void print_result(double val) {
    ostringstream oss;
    oss << val;
    string s = oss.str();
    if (s.find('.') == string::npos) {
        s += ".0";
    }
    cout << s;
}

void print_result(const string& val) {
    cout << '"';
    for (char c : val) {
        if (c == '"') cout << "\\\\\\\"";
        else if (c == '\\\\') cout << "\\\\\\\\";
        else if (c == '\\b') cout << "\\\\b";
        else if (c == '\\f') cout << "\\\\f";
        else if (c == '\\n') cout << "\\\\n";
        else if (c == '\\r') cout << "\\\\r";
        else if (c == '\\t') cout << "\\\\t";
        else cout << c;
    }
    cout << '"';
}

void print_result(const char* val) {
    print_result(string(val));
}

template <typename T>
void print_result(const vector<T>& vec) {
    cout << "[";
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) cout << ",";
        print_result(vec[i]);
    }
    cout << "]";
}
`;

/**
 * Checks before execution whether a problem and language are eligible for unified C++ multi-test execution.
 * 
 * @param {Object} problem 
 * @param {string} language 
 * @returns {boolean}
 */
function isEligibleForUnifiedExecution(problem, language) {
  if (!language || (language !== "cpp" && language !== "c++")) {
    return false;
  }

  if (
    !problem ||
    !problem.execution ||
    typeof problem.execution.functionName !== "string" ||
    !problem.execution.functionName.trim() ||
    !Array.isArray(problem.execution.parameters) ||
    problem.execution.parameters.length === 0
  ) {
    return false;
  }

  if (!Array.isArray(problem.testCases) || problem.testCases.length === 0) {
    return false;
  }

  // Verify that all test cases have inputs that can be typed and formatted
  try {
    for (const tc of problem.testCases) {
      if (!tc || typeof tc !== "object" || !tc.input || typeof tc.input !== "object") {
        return false;
      }
      for (const param of problem.execution.parameters) {
        if (!(param in tc.input)) {
          return false;
        }
        const val = tc.input[param];
        const cppType = inferCppType(val);
        formatCppValue(val, cppType);
      }
    }
  } catch {
    return false;
  }

  return true;
}

/**
 * Generates a unified C++ source file containing:
 * 1. Headers & serializers
 * 2. User's Solution class
 * 3. A single main() that sequentially iterates through all test cases,
 *    instantiates the solver, passes each input, and wraps the serialized output
 *    with explicit machine-readable markers:
 *    __CODESYNC_TEST_<i>_START__
 *    <serialized_output>
 *    __CODESYNC_TEST_<i>_END__
 * 
 * @param {Object} params
 * @param {string} params.solutionCode
 * @param {Object} params.problem
 * @param {Array<Object>} params.testCases - Selected test cases to execute
 * @returns {{ source: string, metadata: Object }}
 */
function generateCppMultiTestHarness({ solutionCode, problem, testCases }) {
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

  const testCaseBlocks = testCases.map((tc, index) => {
    const input = tc.input;
    const argDeclarations = [];
    const argNames = [];

    for (const paramName of parameters) {
      const rawVal = input[paramName];
      const cppType = inferCppType(rawVal);
      const cppVal = formatCppValue(rawVal, cppType);
      const scopedVarName = `arg_${index}_${paramName}`;
      argDeclarations.push(`        ${cppType} ${scopedVarName} = ${cppVal};`);
      argNames.push(scopedVarName);
    }

    const invocationArgs = argNames.join(", ");

    return `    // Test Case #${index + 1}
    {
        cout << "__CODESYNC_TEST_${index}_START__" << endl;
${argDeclarations.join("\n")}
        auto result = solver.${functionName}(${invocationArgs});
        print_result(result);
        cout << endl;
        cout << "__CODESYNC_TEST_${index}_END__" << endl;
    }`;
  });

  const mainFunction = `
int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    Solution solver;

${testCaseBlocks.join("\n\n")}

    return 0;
}
`;

  const source = `${CPP_COMMON_HEADERS_AND_SERIALIZERS}\n${solutionCode.trim()}\n${mainFunction}`;

  return {
    source,
    metadata: {
      problemSlug: problem.slug || null,
      functionName,
      parameters: [...parameters],
      testCaseCount: testCases.length,
      comparator: problem.outputComparator || "exact",
    },
  };
}

/**
 * Parses the structured multi-test output emitted by the unified C++ harness.
 * 
 * @param {string} stdout - Raw stdout from Piston run
 * @param {number} expectedTestCount - Number of tests expected
 * @returns {{
 *   success: boolean,
 *   testOutputs: Array<{ testCaseIndex: number, rawOutput: string, parsedValue: *, completed: boolean }>,
 *   lastCompletedIndex: number,
 *   error?: string
 * }}
 */
function parseMultiTestHarnessOutput(stdout, expectedTestCount) {
  if (typeof stdout !== "string") {
    return {
      success: false,
      testOutputs: [],
      lastCompletedIndex: -1,
      error: "stdout must be a string",
    };
  }

  const testOutputs = [];
  let lastCompletedIndex = -1;

  for (let i = 0; i < expectedTestCount; i++) {
    const startMarker = `__CODESYNC_TEST_${i}_START__`;
    const endMarker = `__CODESYNC_TEST_${i}_END__`;

    const startIndex = stdout.indexOf(startMarker);
    if (startIndex === -1) {
      testOutputs.push({
        testCaseIndex: i,
        rawOutput: "",
        parsedValue: null,
        completed: false,
      });
      continue;
    }

    const contentStart = startIndex + startMarker.length;
    const endIndex = stdout.indexOf(endMarker, contentStart);

    if (endIndex === -1) {
      // Test started but did not complete cleanly (e.g. crash or timeout mid-test)
      const partialRaw = stdout.substring(contentStart).trim();
      testOutputs.push({
        testCaseIndex: i,
        rawOutput: partialRaw,
        parsedValue: null,
        completed: false,
      });
      break;
    }

    const rawOutput = stdout.substring(contentStart, endIndex).trim();
    const parsedValue = parseHarnessOutput(rawOutput);

    testOutputs.push({
      testCaseIndex: i,
      rawOutput,
      parsedValue,
      completed: true,
    });
    lastCompletedIndex = i;
  }

  const allCompleted = testOutputs.length === expectedTestCount && testOutputs.every((t) => t.completed);

  return {
    success: allCompleted,
    testOutputs,
    lastCompletedIndex,
  };
}

module.exports = {
  isEligibleForUnifiedExecution,
  generateCppMultiTestHarness,
  parseMultiTestHarnessOutput,
};
