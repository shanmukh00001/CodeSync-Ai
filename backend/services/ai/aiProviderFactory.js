const GeminiProvider = require("./geminiProvider");
const MockAiProvider = require("./mockAiProvider");
const LocalAIProvider = require("./localAiProvider");
const GroqProvider = require("./groqProvider");

let defaultProvider = null;

/**
 * Returns the configured AI provider instance (singleton by default).
 * Supported AI_PROVIDER values: "mock", "gemini", "groq", "local".
 *
 * @param {Object} [options]
 * @param {boolean} [options.useMock] - Explicitly force mock provider
 * @param {string} [options.provider] - Explicitly override provider type ("mock"|"gemini"|"groq"|"local")
 * @returns {AIProvider}
 */
function getAIProvider(options = {}) {
  if (options.useMock || (process.env.NODE_ENV === "test" && process.env.USE_MOCK_AI === "true")) {
    return new MockAiProvider();
  }

  const providerType = (options.provider || process.env.AI_PROVIDER || "groq").toLowerCase();

  if (providerType === "mock") {
    return new MockAiProvider();
  }

  if (providerType === "groq") {
    if (!defaultProvider || !(defaultProvider instanceof GroqProvider)) {
      defaultProvider = new GroqProvider();
    }
    return defaultProvider;
  }

  if (providerType === "local") {
    if (!defaultProvider || !(defaultProvider instanceof LocalAIProvider)) {
      defaultProvider = new LocalAIProvider();
    }
    return defaultProvider;
  }

  if (!defaultProvider || !(defaultProvider instanceof GeminiProvider)) {
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

