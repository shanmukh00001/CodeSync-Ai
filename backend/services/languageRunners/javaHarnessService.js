/**
 * Java Test Harness Generator Service for CodeSync AI.
 * 
 * Generates deterministic Java source code combining:
 * 1. Necessary imports (java.util.*, etc.)
 * 2. User's Solution class
 * 3. A Main class with serializers and test runner block that executes test cases
 *    and prints JSON serialized output bounded by __CODESYNC_TEST_${i}_START__ / __CODESYNC_TEST_${i}_END__.
 */

function inferJavaType(val) {
  if (typeof val === "boolean") return "boolean";
  if (typeof val === "number") {
    return Number.isInteger(val) ? "int" : "double";
  }
  if (typeof val === "string") return "String";
  if (Array.isArray(val)) {
    if (val.length === 0) return "int[]";
    const first = val[0];
    if (typeof first === "number") {
      return Number.isInteger(first) ? "int[]" : "double[]";
    }
    if (typeof first === "string") return "String[]";
    if (Array.isArray(first)) return "String[][]";
  }
  return "Object";
}

function formatJavaValue(val, type) {
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "number") return val.toString();
  if (typeof val === "string") {
    const escaped = JSON.stringify(val);
    return escaped;
  }
  if (Array.isArray(val)) {
    if (type === "int[]" || (val.length > 0 && typeof val[0] === "number" && Number.isInteger(val[0]))) {
      return `new int[]{${val.join(", ")}}`;
    }
    if (type === "String[]" || (val.length > 0 && typeof val[0] === "string")) {
      const items = val.map((s) => JSON.stringify(s)).join(", ");
      return `new String[]{${items}}`;
    }
    if (type === "String[][]" || (val.length > 0 && Array.isArray(val[0]))) {
      const rows = val.map((row) => `new String[]{${row.map((s) => JSON.stringify(s)).join(", ")}}`).join(", ");
      return `new String[][]{${rows}}`;
    }
    return `new int[]{}`;
  }
  return "null";
}

function generateJavaMultiTestHarness({ solutionCode, problem, testCases }) {
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
      const jType = inferJavaType(rawVal);
      const jVal = formatJavaValue(rawVal, jType);
      const scopedVarName = `arg_${index}_${paramName}`;
      argDeclarations.push(`            ${jType} ${scopedVarName} = ${jVal};`);
      argNames.push(scopedVarName);
    }

    const invocationArgs = argNames.join(", ");

    return `        // Test Case #${index + 1}
        {
            System.out.println("__CODESYNC_TEST_${index}_START__");
${argDeclarations.join("\n")}
            printResult(solver.${functionName}(${invocationArgs}));
            System.out.println();
            System.out.println("__CODESYNC_TEST_${index}_END__");
        }`;
  });

  // Extract imports from user solution code to avoid compilation errors in Java (imports must be at file top)
  const importLines = [];
  const cleanSolutionLines = [];
  for (const line of solutionCode.split("\n")) {
    if (line.trim().startsWith("import ") || line.trim().startsWith("package ")) {
      if (line.trim().startsWith("import ")) {
        importLines.push(line.trim());
      }
    } else {
      cleanSolutionLines.push(line);
    }
  }

  const cleanedSolutionCode = cleanSolutionLines.join("\n").trim();
  const extraImports = importLines.length > 0 ? importLines.join("\n") + "\n" : "";

  const runnerCode = `
import java.util.*;
import java.io.*;
import java.math.*;
${extraImports}
public class Main {
    private static void printResult(Object obj) {
        if (obj == null) {
            System.out.print("null");
        } else if (obj instanceof Boolean) {
            System.out.print(obj);
        } else if (obj instanceof Number) {
            System.out.print(obj);
        } else if (obj instanceof String) {
            System.out.print("\\"" + ((String) obj).replace("\\\\", "\\\\\\\\").replace("\\"", "\\\\\\"") + "\\"");
        } else if (obj instanceof int[]) {
            printResult((int[]) obj);
        } else if (obj instanceof String[]) {
            String[] arr = (String[]) obj;
            System.out.print("[");
            for (int i = 0; i < arr.length; i++) {
                if (i > 0) System.out.print(",");
                printResult(arr[i]);
            }
            System.out.print("]");
        } else if (obj instanceof List) {
            List<?> list = (List<?>) obj;
            System.out.print("[");
            for (int i = 0; i < list.size(); i++) {
                if (i > 0) System.out.print(",");
                printResult(list.get(i));
            }
            System.out.print("]");
        } else {
            System.out.print(obj.toString());
        }
    }

    private static void printResult(int[] arr) {
        if (arr == null) {
            System.out.print("null");
            return;
        }
        System.out.print("[");
        for (int i = 0; i < arr.length; i++) {
            if (i > 0) System.out.print(",");
            System.out.print(arr[i]);
        }
        System.out.print("]");
    }

    private static void printResult(boolean val) {
        System.out.print(val ? "true" : "false");
    }

    private static void printResult(int val) {
        System.out.print(val);
    }

    public static void main(String[] args) {
        Solution solver = new Solution();

${testCaseBlocks.join("\n\n")}
    }
}

${cleanedSolutionCode}
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
  generateJavaMultiTestHarness,
};
