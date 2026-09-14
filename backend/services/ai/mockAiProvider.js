const AIProvider = require("./aiProvider");

/**
 * Mock AI Provider for deterministic testing, CI, and decoupled offline development.
 */
class MockAiProvider extends AIProvider {
  constructor(options = {}) {
    super();
    this.mode = options.mode || "success";
    this.customResponse = options.customResponse || null;
    this.customError = options.customError || null;
    this.callCount = 0;
    this.lastInput = null;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setCustomResponse(response) {
    this.customResponse = response;
  }

  setCustomError(error) {
    this.customError = error;
  }

  async reviewCode(input) {
    this.callCount += 1;
    this.lastInput = input;

    if (this.mode === "error") {
      throw this.customError || new Error("Simulated AI provider failure");
    }

    if (this.mode === "unavailable") {
      const err = new Error("Provider service unavailable");
      err.code = "SERVICE_UNAVAILABLE";
      throw err;
    }

    if (this.mode === "malformed") {
      return this.customResponse || {
        invalidKey: "broken output",
      };
    }

    if (this.customResponse) {
      return this.customResponse;
    }

    // Default valid deterministic response matching Stage 9.0 output contract
    return {
      summary: `The ${input.language || "cpp"} solution uses an iterative algorithm. Complexity is well-structured with clear logic.`,
      verdictAssessment: {
        executionAlignment: "Consistent with test execution expectations",
        timeComplexity: "O(N)",
        spaceComplexity: "O(1)",
        complexityAnalysis: "Single pass over the input collection drives linear runtime with constant auxiliary space.",
      },
      issues: [
        {
          id: "issue-1",
          category: "edge_case",
          severity: "medium",
          title: "Potential unhandled boundary on empty input",
          lineRange: {
            start: 1,
            end: 4,
          },
          explanation: "Collection access without length pre-check may trigger unexpected errors on empty inputs.",
          recommendation: "Add an explicit early return guard for empty collections.",
        },
      ],
      strengths: [
        "Optimal asymptotic complexity achieved with single pass.",
        "Clear and standard idiomatic variable naming.",
      ],
      actionableSuggestions: [
        "Consider extracting boundary validation logic into a dedicated helper.",
        "Add inline commentary explaining loop invariant conditions.",
      ],
    };
  }
}

module.exports = MockAiProvider;
