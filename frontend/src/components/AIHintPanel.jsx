import { memo } from "react";
import "./AIHintPanel.css";

function AIHintPanel({ hint, loading, error, onClose, onRequestHint }) {
  const hintLevel = (hint?.hintLevel || "gentle").toLowerCase();
  const levelLabel =
    hintLevel === "refinement"
      ? "Refinement"
      : hintLevel === "targeted"
      ? "Targeted"
      : "Gentle";

  return (
    <div className="ai-hint-panel" role="region" aria-label="AI Algorithmic Hint">
      <div className="ai-hint-header">
        <div className="ai-hint-header-left">
          <span className="ai-hint-badge">AI HINT</span>
          {hint && <span className={`ai-hint-level-tag level-${hintLevel}`}>{levelLabel}</span>}
          <span className="ai-hint-advisory-tag">Socratic Guidance</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="ai-hint-close-btn"
            onClick={onClose}
            aria-label="Close AI hint panel"
            title="Close AI hint"
          >
            ✕
          </button>
        )}
      </div>

      <div className="ai-hint-body">
        {!loading && !error && !hint && (
          <div className="ai-empty-placeholder">
            <div className="ai-placeholder-icon">💡</div>
            <h3 className="ai-placeholder-title">Need Algorithmic Direction?</h3>
            <p className="ai-placeholder-desc">
              Get progressive, Socratic hints tailored to your code state without spoiling the complete solution. We guide your thought process step by step.
            </p>
            {onRequestHint && (
              <button
                type="button"
                className="ai-placeholder-action-btn btn-hint-action"
                onClick={onRequestHint}
              >
                🔍 Get Socratic Hint
              </button>
            )}
            <div className="ai-placeholder-features">
              <div className="placeholder-feature-item">
                <span className="feature-dot amber"></span>
                <span>Gentle nudges on optimal data structures</span>
              </div>
              <div className="placeholder-feature-item">
                <span className="feature-dot amber"></span>
                <span>Subtle pattern recognition questions</span>
              </div>
              <div className="placeholder-feature-item">
                <span className="feature-dot amber"></span>
                <span>Guaranteed non-spoiler thinking checkpoints</span>
              </div>
            </div>
          </div>
        )}
        {/* If loading, show top spinner banner without clearing existing hint */}
        {loading && (
          <div className="ai-hint-loading" role="status" aria-live="polite">
            <div className="ai-hint-spinner" aria-hidden="true" />
            <div className="ai-hint-loading-text">
              <span className="ai-hint-loading-title">Formulating Socratic Hint…</span>
              <span className="ai-hint-loading-desc">
                Analyzing problem structure and identifying the next logical reasoning step.
              </span>
            </div>
          </div>
        )}

        {/* If error occurred, show error banner above existing hint if present */}
        {error && (
          <div className="ai-hint-error" role="alert">
            <div className="ai-hint-error-icon" aria-hidden="true">!</div>
            <div className="ai-hint-error-content">
              <div className="ai-hint-error-title">AI Hint Notice</div>
              <div className="ai-hint-error-message">{error}</div>
            </div>
          </div>
        )}

        {/* Render structured hint fields whenever a hint is available */}
        {hint && (
          <div className="ai-hint-content">
            {/* Core Algorithmic Concept */}
            {hint.concept && (
              <section className="ai-hint-section">
                <h4 className="ai-hint-section-title">Concept</h4>
                <div className="ai-hint-card concept-card">
                  <p className="ai-hint-text">{hint.concept}</p>
                </div>
              </section>
            )}

            {/* Observation */}
            {hint.observation && (
              <section className="ai-hint-section">
                <h4 className="ai-hint-section-title">Observation</h4>
                <div className="ai-hint-card observation-card">
                  <p className="ai-hint-text">{hint.observation}</p>
                </div>
              </section>
            )}

            {/* Suggested Step */}
            {hint.suggestedStep && (
              <section className="ai-hint-section">
                <h4 className="ai-hint-section-title">Suggested Step</h4>
                <div className="ai-hint-card step-card">
                  <p className="ai-hint-text step-text">{hint.suggestedStep}</p>
                </div>
              </section>
            )}

            {/* Pitfall to Avoid */}
            {hint.pitfallToAvoid && (
              <section className="ai-hint-section">
                <h4 className="ai-hint-section-title">Pitfall to Avoid</h4>
                <div className="ai-hint-card pitfall-card">
                  <p className="ai-hint-text pitfall-text">{hint.pitfallToAvoid}</p>
                </div>
              </section>
            )}

            {/* Optional Question to Consider */}
            {hint.questionToConsider && (
              <section className="ai-hint-section">
                <h4 className="ai-hint-section-title">Question to Consider</h4>
                <div className="ai-hint-card question-card">
                  <p className="ai-hint-text question-text">{hint.questionToConsider}</p>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AIHintPanel);
