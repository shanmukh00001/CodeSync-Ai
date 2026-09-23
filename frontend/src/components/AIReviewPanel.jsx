import { memo } from "react";
import "./AIReviewPanel.css";

function formatLineRange(lineRange) {
  if (!lineRange || typeof lineRange.start !== "number") return null;
  if (lineRange.start === lineRange.end || typeof lineRange.end !== "number") {
    return `Line ${lineRange.start}`;
  }
  return `Lines ${lineRange.start}–${lineRange.end}`;
}

function AIReviewPanel({ review, loading, error, onClose, onRequestReview }) {
  return (
    <div className="ai-review-panel" role="region" aria-label="AI Code Review">
      <div className="ai-review-header">
        <div className="ai-review-header-left">
          <span className="ai-review-badge">AI REVIEW</span>
          <span className="ai-review-advisory-tag">Advisory Static Analysis</span>
        </div>
        {onClose && (
          <button
            type="button"
            className="ai-review-close-btn"
            onClick={onClose}
            aria-label="Close AI review panel"
            title="Close AI review"
          >
            ✕
          </button>
        )}
      </div>

      <div className="ai-review-body">
        {!loading && !error && !review && (
          <div className="ai-empty-placeholder">
            <div className="ai-placeholder-icon">🤖</div>
            <h3 className="ai-placeholder-title">No AI Review Generated Yet</h3>
            <p className="ai-placeholder-desc">
              Request an in-depth AI analysis of your current code draft to evaluate algorithmic time & space complexity, edge cases, code smells, and performance bottlenecks.
            </p>
            {onRequestReview && (
              <button
                type="button"
                className="ai-placeholder-action-btn btn-review-action"
                onClick={onRequestReview}
              >
                ⚡ Review Current Code
              </button>
            )}
            <div className="ai-placeholder-features">
              <div className="placeholder-feature-item">
                <span className="feature-dot"></span>
                <span>Time & Space complexity estimation</span>
              </div>
              <div className="placeholder-feature-item">
                <span className="feature-dot"></span>
                <span>Subtle bug & boundary condition detection</span>
              </div>
              <div className="placeholder-feature-item">
                <span className="feature-dot"></span>
                <span>Architectural cleanliness & best practices</span>
              </div>
            </div>
          </div>
        )}
        {loading && (
          <div className="ai-review-loading">
            <div className="ai-review-spinner" aria-hidden="true" />
            <div className="ai-review-loading-text">
              <span className="ai-review-loading-title">Analyzing Code…</span>
              <span className="ai-review-loading-desc">
                Evaluating algorithmic complexity, edge cases, and code quality.
              </span>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="ai-review-error">
            <div className="ai-review-error-icon" aria-hidden="true">!</div>
            <div className="ai-review-error-content">
              <div className="ai-review-error-title">AI Review Error</div>
              <div className="ai-review-error-message">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && review && (
          <div className="ai-review-content">
            {/* Executive Summary */}
            {review.summary && (
              <section className="ai-review-section">
                <h4 className="ai-review-section-title">Summary</h4>
                <p className="ai-review-summary-text">{review.summary}</p>
              </section>
            )}

            {/* Verdict & Complexity Assessment */}
            {review.verdictAssessment && (
              <section className="ai-review-section">
                <h4 className="ai-review-section-title">Complexity & Assessment</h4>
                <div className="ai-review-complexity-grid">
                  <div className="ai-review-metric-box">
                    <span className="ai-review-metric-label">TIME COMPLEXITY</span>
                    <span className="ai-review-metric-value">
                      {review.verdictAssessment.timeComplexity || "—"}
                    </span>
                  </div>
                  <div className="ai-review-metric-box">
                    <span className="ai-review-metric-label">SPACE COMPLEXITY</span>
                    <span className="ai-review-metric-value">
                      {review.verdictAssessment.spaceComplexity || "—"}
                    </span>
                  </div>
                </div>

                {review.verdictAssessment.complexityAnalysis && (
                  <p className="ai-review-complexity-desc">
                    {review.verdictAssessment.complexityAnalysis}
                  </p>
                )}

                {review.verdictAssessment.executionAlignment && (
                  <div className="ai-review-alignment-box">
                    <span className="ai-review-alignment-label">Execution Alignment:</span>{" "}
                    <span className="ai-review-alignment-value">
                      {review.verdictAssessment.executionAlignment}
                    </span>
                  </div>
                )}
              </section>
            )}

            {/* Issues Section */}
            <section className="ai-review-section">
              <h4 className="ai-review-section-title">
                Issues ({Array.isArray(review.issues) ? review.issues.length : 0})
              </h4>
              {Array.isArray(review.issues) && review.issues.length > 0 ? (
                <div className="ai-review-issues-list">
                  {review.issues.map((issue, idx) => {
                    const sev = (issue.severity || "info").toLowerCase();
                    const lineStr = formatLineRange(issue.lineRange);
                    return (
                      <div
                        key={issue.id || `issue-${idx}`}
                        className={`ai-review-issue-card severity-${sev}`}
                      >
                        <div className="ai-review-issue-header">
                          <div className="ai-review-issue-badges">
                            <span className={`ai-review-sev-tag sev-${sev}`}>
                              {issue.severity ? issue.severity.toUpperCase() : "INFO"}
                            </span>
                            {issue.category && (
                              <span className="ai-review-cat-tag">
                                {issue.category}
                              </span>
                            )}
                            {lineStr && (
                              <span className="ai-review-line-tag">{lineStr}</span>
                            )}
                          </div>
                        </div>

                        <div className="ai-review-issue-title">{issue.title}</div>

                        {issue.explanation && (
                          <div className="ai-review-issue-detail">
                            <span className="ai-review-detail-label">Explanation:</span>
                            <p className="ai-review-detail-text">{issue.explanation}</p>
                          </div>
                        )}

                        {issue.recommendation && (
                          <div className="ai-review-issue-detail">
                            <span className="ai-review-detail-label">Recommendation:</span>
                            <p className="ai-review-detail-text recommendation">
                              {issue.recommendation}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="ai-review-empty-state">
                  No significant issues identified in the submitted code.
                </div>
              )}
            </section>

            {/* Strengths */}
            {Array.isArray(review.strengths) && review.strengths.length > 0 && (
              <section className="ai-review-section">
                <h4 className="ai-review-section-title">Strengths</h4>
                <ul className="ai-review-bullets-list">
                  {review.strengths.map((str, idx) => (
                    <li key={idx} className="ai-review-bullet-item strength">
                      <span className="ai-review-bullet-marker" aria-hidden="true">✓</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Actionable Suggestions */}
            {Array.isArray(review.actionableSuggestions) &&
              review.actionableSuggestions.length > 0 && (
                <section className="ai-review-section">
                  <h4 className="ai-review-section-title">Actionable Suggestions</h4>
                  <ul className="ai-review-bullets-list">
                    {review.actionableSuggestions.map((sug, idx) => (
                      <li key={idx} className="ai-review-bullet-item suggestion">
                        <span className="ai-review-bullet-marker" aria-hidden="true">→</span>
                        <span>{sug}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(AIReviewPanel);
