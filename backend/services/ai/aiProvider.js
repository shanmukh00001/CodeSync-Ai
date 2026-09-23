/**
 * CodeSync AI — AI Provider Abstract Interface
 * 
 * Defines the contract for all AI model integrations (Gemini, Claude, OpenAI, Mock, etc.).
 * Implementations must take normalized review inputs and return a structured review object.
 */

class AIProvider {
  /**
   * Evaluates submitted source code against problem context and returns structured feedback.
   * 
   * @param {Object} input - Provider-independent review input
   * @param {string} input.language - Programming language ("cpp" | "javascript" | "python" | "java")
   * @param {string} input.code - User source code
   * @param {Object} input.problem - Problem context (public description, difficulty, examples, constraints)
   * @param {string} input.problem.title - Problem title
   * @param {string} input.problem.description - Problem description
   * @param {string} input.problem.difficulty - Problem difficulty ("Easy" | "Medium" | "Hard")
   * @param {Array<Object>} [input.problem.examples] - Visible example test cases
   * @param {Array<string>} [input.problem.constraints] - Problem constraints
   * @param {Object} [input.lastExecutionResult] - High-level execution summary
   * @param {string} [input.lastExecutionResult.status] - High level status
   * @param {number} [input.lastExecutionResult.passedTestCases] - Visible passed test count
   * @param {number} [input.lastExecutionResult.totalTestCases] - Visible total test count
   * @param {number} [input.lastExecutionResult.runtimeMs] - Execution duration
   * @param {number} [input.lastExecutionResult.memoryKb] - Execution memory
   * @returns {Promise<Object>} Raw review object prior to service validation
   */
  async reviewCode(input) {
    throw new Error("Method reviewCode() must be implemented by concrete AI provider");
  }

  /**
   * Generates targeted, Socratic algorithmic guidance for a user without returning complete solutions.
   * 
   * @param {Object} input - Provider-independent hint input
   * @param {string} input.language - Programming language ("cpp" | "javascript" | "python" | "java")
   * @param {string} input.code - User source code
   * @param {Object} input.problem - Problem context (public description, difficulty, examples, constraints)
   * @param {string} input.problem.title - Problem title
   * @param {string} input.problem.description - Problem description
   * @param {string} input.problem.difficulty - Problem difficulty ("Easy" | "Medium" | "Hard")
   * @param {Array<Object>} [input.problem.examples] - Visible example test cases
   * @param {Array<string>} [input.problem.constraints] - Problem constraints
   * @param {Object} [input.lastExecutionResult] - High-level execution summary
   * @returns {Promise<Object>} Raw hint object prior to service validation
   */
  async generateHint(input) {
    throw new Error("Method generateHint() must be implemented by concrete AI provider");
  }

  /**
   * Decorates candidate coding challenges with personalized pedagogical rationale.
   *
   * @param {Object} input - Provider-independent recommendation input
   * @param {Object} input.profileSummary - Sanitized user profile summary
   * @param {Array<Object>} input.candidateProblems - Sanitized candidate problem metadata
   * @returns {Promise<Object>} Raw recommendations object prior to service validation
   */
  async generateRecommendations(input) {
    throw new Error("Method generateRecommendations() must be implemented by concrete AI provider");
  }
}

module.exports = AIProvider;

