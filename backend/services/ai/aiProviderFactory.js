const GeminiProvider = require("./geminiProvider");
const MockAiProvider = require("./mockAiProvider");

let defaultProvider = null;

/**
 * Returns the configured AI provider instance (singleton by default).
 *
 * @param {Object} [options]
 * @param {boolean} [options.useMock] - Explicitly force mock provider
 * @returns {AIProvider}
 */
function getAIProvider(options = {}) {
  if (options.useMock || process.env.NODE_ENV === "test" && process.env.USE_MOCK_AI === "true") {
    return new MockAiProvider();
  }

  if (!defaultProvider) {
    defaultProvider = new GeminiProvider();
  }

  return defaultProvider;
}

/**
 * For testing purposes: allows overriding or resetting the active provider.
 *
 * @param {AIProvider|null} provider
 */
function setAIProvider(provider) {
  defaultProvider = provider;
}

module.exports = {
  getAIProvider,
  setAIProvider,
};
