/**
 * C++ Test Harness Generator Service for CodeSync AI.
 * 
 * Generates deterministic, fully compilable C++ standalone source code combining:
 * 1. Standard C++ library headers & serialization helpers
 * 2. User's Solution class
 * 3. A generated main() that deserializes test input, executes the target function,
 *    and prints the serialized result to stdout in strict JSON-compatible format.
 */

/**
 * Escapes a JavaScript string to a valid C++ string literal body.
 * Handles double-quotes, backslashes, newlines, carriage returns, and tabs.
 * 
 * @param {string} str 
 * @returns {string} Escaped C++ string literal including surrounding quotes
 */
function toCppStringLiteral(str) {
  const escaped = String(str)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
  return `"${escaped}"`;
}

/**
 * Infers C++ type from a JavaScript value.
 * Supported types: int, double, bool, string, vector<int>, vector<string>, vector<vector<string>>
 * 
 * @param {*} val 
 * @returns {string} C++ type string
 */
function inferCppType(val) {
  if (typeof val === "boolean") {
    return "bool";
  }
  if (typeof val === "number") {
    return Number.isInteger(val) ? "int" : "double";
  }
  if (typeof val === "string") {
    return "string";
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      // Default empty array to vector<int> or fallback
      return "vector<int>";
    }
    const first = val[0];
    if (typeof first === "number") {
      return "vector<int>";
    }
    if (typeof first === "string") {
      return "vector<string>";
    }
    if (Array.isArray(first)) {
      return "vector<vector<string>>";
    }
  }
  throw new Error(`Unsupported argument value or shape for C++ harness: ${JSON.stringify(val)}`);
}

/**
 * Formats a JavaScript value into C++ initializer syntax.
 * 
 * @param {*} val 
 * @param {string} [targetType] 
 * @returns {string} C++ literal / initializer list
 */
function formatCppValue(val, targetType) {
  if (typeof val === "boolean") {
    return val ? "true" : "false";
  }
  if (typeof val === "number") {
    if (targetType === "double" || (!Number.isInteger(val))) {
      const s = val.toString();
      return s.includes(".") ? s : `${s}.0`;
    }
    return val.toString();
  }
  if (typeof val === "string") {
    return toCppStringLiteral(val);
  }
  if (Array.isArray(val)) {
    if (val.length === 0) {
      return "{}";
    }
    const inner = val.map((item) => formatCppValue(item)).join(", ");
    return `{${inner}}`;
  }
  throw new Error(`Unsupported value for C++ code generation: ${JSON.stringify(val)}`);
}

/**
 * Header templates and serialization functions in C++.
 * Prints booleans as true/false, vectors in strict JSON array format `[e1,e2]`,
 * nested vectors as `[[e1],[e2]]`, and strings as `"..."` with escaping.
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
    // Format double cleanly without trailing zeroes if integer, or with exact decimal representation
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
        if (c == '"') cout << "\\\\\\"";
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
 * Validates inputs before generating C++ harness source.
 * 
 * @param {Object} params
 * @param {string} params.solutionCode
 * @param {Object} params.problem
 * @param {Object} params.testCase
 */
function validateHarnessInput({ solutionCode, problem, testCase }) {
  if (typeof solutionCode !== "string" || !solutionCode.trim()) {
    throw new Error("Validation Error: solutionCode must be a non-empty string");
  }

  if (!problem || typeof problem !== "object") {
    throw new Error("Validation Error: problem object is required");
  }

  if (!problem.execution || typeof problem.execution.functionName !== "string" || !problem.execution.functionName.trim()) {
    throw new Error("Validation Error: problem.execution.functionName must be a valid string");
  }

  if (!Array.isArray(problem.execution.parameters)) {
    throw new Error("Validation Error: problem.execution.parameters must be an array");
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
 * Generates a complete, compilable C++ source code harness for a given problem,
 * user solution code, and test case.
 * 
 * @param {Object} params
 * @param {string} params.solutionCode - User's C++ Solution class implementation
 * @param {Object} params.problem - Problem metadata from MongoDB
 * @param {Object} params.testCase - Test case with input object
 * @returns {{ source: string, metadata: Object }} Generated source code and execution metadata
 */
function generateCppHarness({ solutionCode, problem, testCase }) {
  validateHarnessInput({ solutionCode, problem, testCase });

  const { functionName, parameters } = problem.execution;
  const input = testCase.input;

  // Build argument declarations
  const argDeclarations = [];
  const argNames = [];

  for (const paramName of parameters) {
    const rawVal = input[paramName];
    const cppType = inferCppType(rawVal);
    const cppVal = formatCppValue(rawVal, cppType);
    argDeclarations.push(`    ${cppType} ${paramName} = ${cppVal};`);
    argNames.push(paramName);
  }

  const invocationArgs = argNames.join(", ");

  const mainFunction = `
int main() {
    // Instantiate user solution
    Solution solver;

    // Test case arguments
${argDeclarations.join("\n")}

    // Execute solution
    auto result = solver.${functionName}(${invocationArgs});

    // Output serialized result
    print_result(result);
    cout << endl;

    return 0;
}
`;

  const source = `${CPP_COMMON_HEADERS_AND_SERIALIZERS}\n${solutionCode.trim()}\n${mainFunction}`;

  const metadata = {
    problemSlug: problem.slug || null,
    functionName,
    parameters: [...parameters],
    comparator: problem.outputComparator || "exact",
  };

  return {
    source,
    metadata,
  };
}

module.exports = {
  generateCppHarness,
  inferCppType,
  formatCppValue,
  toCppStringLiteral,
  validateHarnessInput,
};
