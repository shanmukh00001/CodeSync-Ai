export const LANGUAGE_LABELS = {
  cpp: "C++",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
};

export const formatLanguage = (code) =>
  LANGUAGE_LABELS[code] || (code ? code.toUpperCase() : "—");

export function formatExecutionResult(res) {
  if (!res) return "No execution result returned.";
  const status = res.status || "unknown";
  const passed = typeof res.passedTestCases === "number" ? res.passedTestCases : 0;
  const total = typeof res.totalTestCases === "number" ? res.totalTestCases : 0;
  const runtime = typeof res.runtimeMs === "number" ? `${res.runtimeMs} ms` : null;
  const memory = typeof res.memoryKb === "number" ? `${res.memoryKb} KB` : null;

  if (status === "accepted") {
    let text = `✓ Accepted\n\n`;
    text += `• Test cases: ${passed} / ${total} passed\n`;
    if (runtime) text += `• Runtime: ${runtime}\n`;
    if (memory) text += `• Memory: ${memory}\n`;
    return text.trim();
  }

  if (status === "wrong_answer") {
    let text = `✗ Wrong Answer\n\n`;
    text += `• Test cases: ${passed} / ${total} passed\n`;
    if (res.failedTestCase) {
      const ft = res.failedTestCase;
      const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
      text += `• Failed on test case #${testIdx}\n\n`;
      if (ft.isHidden === true) {
        text += `Note: Hidden test failed\n`;
      } else {
        if (ft.input !== undefined && ft.input !== null) {
          text += `Input:\n${typeof ft.input === "object" ? JSON.stringify(ft.input, null, 2) : ft.input}\n\n`;
        }
        if (ft.expected !== undefined && ft.expected !== null) {
          text += `Expected Output:\n${typeof ft.expected === "object" ? JSON.stringify(ft.expected, null, 2) : ft.expected}\n\n`;
        }
        if (ft.actual !== undefined && ft.actual !== null) {
          text += `Your Output:\n${typeof ft.actual === "object" ? JSON.stringify(ft.actual, null, 2) : ft.actual}\n`;
        }
      }
    }
    return text.trim();
  }

  if (status === "compilation_error") {
    let text = `✗ Compilation Error\n\n`;
    if (res.error) {
      text += `${res.error}\n`;
    } else {
      text += `Code failed to compile.\n`;
    }
    return text.trim();
  }

  if (status === "runtime_error") {
    let text = `✗ Runtime Error\n\n`;
    if (res.error) {
      text += `${res.error}\n`;
    } else if (res.failedTestCase?.errorMessage) {
      text += `${res.failedTestCase.errorMessage}\n`;
    } else {
      text += `Program encountered a runtime error during execution.\n`;
    }
    return text.trim();
  }

  if (status === "time_limit_exceeded") {
    let text = `✗ Time Limit Exceeded\n\n`;
    text += `• Execution timed out.\n`;
    if (res.failedTestCase) {
      const ft = res.failedTestCase;
      const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
      text += `• Timed out on test case #${testIdx}\n`;
    }
    return text.trim();
  }

  if (status === "internal_error") {
    return `✗ Execution Engine Error\n\nThe code execution service encountered an internal error. Please try again.`;
  }

  return `Status: ${status}\n• Test cases: ${passed} / ${total} passed`;
}

export function formatSubmissionResult(sub) {
  if (!sub) return "No submission result returned.";
  const status = sub.status || "Unknown";
  const passed = typeof sub.passedTestCases === "number" ? sub.passedTestCases : 0;
  const total = typeof sub.totalTestCases === "number" ? sub.totalTestCases : 0;
  const runtime = typeof sub.runtimeMs === "number" && sub.runtimeMs > 0 ? `${sub.runtimeMs} ms` : null;
  const memory = typeof sub.memoryKb === "number" && sub.memoryKb > 0 ? `${sub.memoryKb} KB` : null;

  let text = "";
  if (status === "Accepted") {
    text += `✓ Accepted\n\n`;
    text += `• Test cases: ${passed} / ${total} passed\n`;
    if (runtime) text += `• Runtime: ${runtime}\n`;
    if (memory) text += `• Memory: ${memory}\n`;
  } else if (status === "Wrong Answer") {
    text += `✗ Wrong Answer\n\n`;
    text += `• Test cases: ${passed} / ${total} passed\n`;
    if (sub.failedTestCase) {
      const ft = sub.failedTestCase;
      const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
      text += `• Failed on test case #${testIdx}\n\n`;
      if (ft.isHidden === true) {
        text += `Note: Hidden test failed\n`;
      } else {
        if (ft.input !== undefined && ft.input !== null) {
          text += `Input:\n${typeof ft.input === "object" ? JSON.stringify(ft.input, null, 2) : ft.input}\n\n`;
        }
        if (ft.expected !== undefined && ft.expected !== null) {
          text += `Expected Output:\n${typeof ft.expected === "object" ? JSON.stringify(ft.expected, null, 2) : ft.expected}\n\n`;
        }
        if (ft.actual !== undefined && ft.actual !== null) {
          text += `Your Output:\n${typeof ft.actual === "object" ? JSON.stringify(ft.actual, null, 2) : ft.actual}\n`;
        }
      }
    }
  } else if (status === "Compilation Error") {
    text += `✗ Compilation Error\n\n`;
    if (sub.error) {
      text += `${sub.error}\n`;
    } else {
      text += `Code failed to compile.\n`;
    }
  } else if (status === "Runtime Error") {
    text += `✗ Runtime Error\n\n`;
    if (sub.error) {
      text += `${sub.error}\n`;
    } else if (sub.failedTestCase?.errorMessage) {
      text += `${sub.failedTestCase.errorMessage}\n`;
    } else {
      text += `Program encountered a runtime error during execution.\n`;
    }
  } else if (status === "Time Limit Exceeded") {
    text += `✗ Time Limit Exceeded\n\n`;
    text += `• Execution timed out.\n`;
    if (sub.failedTestCase) {
      const ft = sub.failedTestCase;
      const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
      text += `• Timed out on test case #${testIdx}\n`;
    }
  } else {
    text += `Status: ${status}\n• Test cases: ${passed} / ${total} passed\n`;
  }

  return text.trim();
}

export function formatMessageTime(dateStr) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}
