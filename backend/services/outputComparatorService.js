/**
 * Output Comparator Service for CodeSync AI.
 * 
 * Supports comparing execution outputs against expected outputs according to problem semantics:
 * - exact: Strict equality comparison (ignoring terminal newlines).
 * - unordered_array: 1D array comparison where element order does not matter, but element multiplicity is preserved.
 * - unordered_nested_array: 2D array comparison where both outer group order and inner element order do not matter,
 *   while preserving group and element multiplicities.
 */

/**
 * Parses raw stdout emitted by C++ test harness into a structured JavaScript value.
 * 
 * Serialization contract from cppHarnessService:
 * - Booleans: "true" | "false"
 * - Integers/Doubles: numbers as strings (e.g. "123", "2.0")
 * - Strings: JSON quoted strings (e.g. "\"abc\"")
 * - Vectors: JSON formatted arrays (e.g. "[1,2,3]", "[[\"a\"],[\"b\"]]")
 * 
 * @param {string} stdout - Raw stdout from program execution
 * @returns {*} Parsed JavaScript representation
 */
function parseHarnessOutput(stdout) {
  if (typeof stdout !== "string") {
    return stdout;
  }

  const trimmed = stdout.trim();

  if (trimmed === "") {
    return "";
  }

  // Handle boolean literals
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // Try JSON.parse for arrays, objects, numbers, and quoted strings
  try {
    return JSON.parse(trimmed);
  } catch {
    // If not JSON-parsable, return raw trimmed string
    return trimmed;
  }
}

/**
 * Deep equality check for arbitrary primitive or structured values.
 * 
 * @param {*} a 
 * @param {*} b 
 * @returns {boolean}
 */
function isDeepEqual(a, b) {
  if (a === b) return true;

  if (typeof a === "number" && typeof b === "number") {
    // Treat exact numbers or close floating point as equal
    return Math.abs(a - b) < 1e-6;
  }

  if (typeof a !== "object" || a === null || typeof b !== "object" || b === null) {
    return false;
  }

  if (Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }

  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!Object.prototype.hasOwnProperty.call(b, key) || !isDeepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Compares two 1D arrays ignoring element order while preserving multiplicity.
 * 
 * @param {Array} actual 
 * @param {Array} expected 
 * @returns {boolean}
 */
function compareUnorderedArray(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return false;
  }

  if (actual.length !== expected.length) {
    return false;
  }

  const matchedIndices = new Set();

  for (const expectedItem of expected) {
    let matchFound = false;
    for (let i = 0; i < actual.length; i++) {
      if (!matchedIndices.has(i) && isDeepEqual(actual[i], expectedItem)) {
        matchedIndices.add(i);
        matchFound = true;
        break;
      }
    }
    if (!matchFound) {
      return false;
    }
  }

  return true;
}

/**
 * Compares two 2D arrays where both outer group order and inner element order do not matter,
 * while preserving multiplicity of elements within groups and multiplicity of groups.
 * 
 * @param {Array<Array>} actual 
 * @param {Array<Array>} expected 
 * @returns {boolean}
 */
function compareUnorderedNestedArray(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected)) {
    return false;
  }

  if (actual.length !== expected.length) {
    return false;
  }

  const matchedGroupIndices = new Set();

  for (const expectedGroup of expected) {
    let groupMatchFound = false;

    for (let i = 0; i < actual.length; i++) {
      if (!matchedGroupIndices.has(i) && Array.isArray(actual[i])) {
        if (compareUnorderedArray(actual[i], expectedGroup)) {
          matchedGroupIndices.add(i);
          groupMatchFound = true;
          break;
        }
      }
    }

    if (!groupMatchFound) {
      return false;
    }
  }

  return true;
}

/**
 * Compares actual output from execution against expected problem output according to comparator rules.
 * 
 * @param {Object} params
 * @param {*} params.actual - Parsed or raw actual output
 * @param {*} params.expected - Expected output from problem test case
 * @param {"exact" | "unordered_array" | "unordered_nested_array"} [params.comparator="exact"]
 * @returns {{ passed: boolean, actual: *, expected: *, comparator: string }}
 */
function compareOutput({ actual, expected, comparator = "exact" }) {
  let passed = false;

  switch (comparator) {
    case "unordered_array":
      passed = compareUnorderedArray(actual, expected);
      break;

    case "unordered_nested_array":
      passed = compareUnorderedNestedArray(actual, expected);
      break;

    case "exact":
    default:
      passed = isDeepEqual(actual, expected);
      break;
  }

  return {
    passed,
    actual,
    expected,
    comparator,
  };
}

module.exports = {
  parseHarnessOutput,
  compareOutput,
  isDeepEqual,
  compareUnorderedArray,
  compareUnorderedNestedArray,
};
