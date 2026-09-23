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

  async generateHint(input) {
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
        invalidHintKey: "broken output",
      };
    }

    if (this.customResponse) {
      return this.customResponse;
    }

    // Default valid deterministic response matching Stage 10 contract
    return {
      hintLevel: "targeted",
      concept: "Hash Map Complement Lookup",
      observation: `In this ${input.language || "cpp"} implementation, iterating repeatedly through the data introduces quadratic overhead.`,
      suggestedStep: "Maintain a frequency or index map while traversing elements in a single pass to check for target complements in O(1) time.",
      pitfallToAvoid: "Ensure the current element at index i is not paired with itself.",
      questionToConsider: "What data structure allows checking prior occurrences in constant time?",
    };
  }

  async generateRecommendations(input) {
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
        invalidRecKey: "broken output",
      };
    }

    if (this.customResponse) {
      return this.customResponse;
    }

    const candidates = Array.isArray(input.candidateProblems) ? input.candidateProblems : [];
    const recommendations = candidates.slice(0, 3).map((p) => ({
      problemId: p.id,
      reason: `Strengthens your understanding of ${(p.tags && p.tags[0]) || p.difficulty} algorithmic patterns.`,
      focus: `Mastering ${(p.tags && p.tags[0]) || p.difficulty} techniques and edge case handling.`,
      nextStep: "Identify the problem constraints and design your initial data structure.",
      matchType: p.defaultMatchType || "Skill Progression",
    }));

    return {
      recommendations,
    };
  }
}

module.exports = MockAiProvider;

