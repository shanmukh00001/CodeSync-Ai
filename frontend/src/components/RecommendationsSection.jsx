import "./RecommendationsSection.css";

function formatDifficultyClass(difficulty) {
  const diff = String(difficulty || "").toLowerCase();
  if (diff === "easy") return "diff-easy";
  if (diff === "medium") return "diff-medium";
  if (diff === "hard") return "diff-hard";
  return "";
}

function RecommendationsSection({
  recommendationsData,
  loading,
  error,
  onRetry,
  onOpenProblem,
}) {
  const profileSummary = recommendationsData?.profileSummary;
  const rawList = recommendationsData?.recommendations;
  const recommendations = Array.isArray(rawList)
    ? rawList.filter((item) => item && typeof item === "object" && item.problem && item.problem.id)
    : [];

  return (
    <section
      className="recommendations-section"
      aria-label="Recommended Practice Problems"
    >
      <div className="recommendations-header">
        <div className="recommendations-title-group">
          <div className="recommendations-badge-row">
            <h2 className="recommendations-heading">Recommended Practice</h2>
            <span className="recommendations-type-pill">Personalized</span>
          </div>
          <p className="recommendations-subtitle">
            Curated problem recommendations tailored to your recent coding activity, solved history, and topic progression.
          </p>
        </div>

        {profileSummary && !loading && !error && (
          <div className="recommendations-profile-summary">
            {typeof profileSummary.totalSolved === "number" && (
              <div className="summary-stat">
                <span className="summary-stat-label">Solved</span>
                <span className="summary-stat-value">{profileSummary.totalSolved}</span>
              </div>
            )}
            {profileSummary.primaryDifficulty && (
              <div className="summary-stat">
                <span className="summary-stat-label">Level</span>
                <span className="summary-stat-value">{profileSummary.primaryDifficulty}</span>
              </div>
            )}
            {profileSummary.focusArea && (
              <div className="summary-stat">
                <span className="summary-stat-label">Focus</span>
                <span className="summary-stat-value">{profileSummary.focusArea}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="recommendations-loading-grid" aria-busy="true" aria-label="Loading recommended problems">
          {[1, 2, 3].map((idx) => (
            <div key={idx} className="recommendation-card-skeleton">
              <div className="skeleton-bar skeleton-title" />
              <div className="skeleton-bar skeleton-tags" />
              <div className="skeleton-bar skeleton-body" />
              <div className="skeleton-bar skeleton-body short" />
              <div className="skeleton-bar skeleton-btn" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="recommendations-error-box" role="alert">
          <span className="recommendations-error-text">{error}</span>
          {onRetry && (
            <button
              type="button"
              className="recommendations-retry-btn"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="recommendations-empty-box">
          <p className="recommendations-empty-text">
            No recommendations available right now. You may have completed all currently available curated problems, or start practicing more problems to generate tailored recommendations.
          </p>
        </div>
      ) : (
        <div className="recommendations-grid">
          {recommendations.map((item, index) => {
            const problem = item.problem || {};
            const problemId = problem.id || problem._id || `rec-${index}`;
            const problemSlug = problem.slug || problemId;
            const title = problem.title || "Untitled Problem";
            const difficulty = problem.difficulty || "Medium";
            const tags = Array.isArray(problem.tags) ? problem.tags : [];
            const reason = typeof item.reason === "string" ? item.reason : "";
            const focus = typeof item.focus === "string" ? item.focus : "";
            const nextStep = typeof item.nextStep === "string" ? item.nextStep : "";
            const matchType = typeof item.matchType === "string" && item.matchType.trim() ? item.matchType : "Practice";

            return (
              <article
                key={problemId}
                className="recommendation-card"
                aria-labelledby={`rec-title-${problemId}`}
              >
                <div className="rec-card-top">
                  <div className="rec-card-title-row">
                    <h3 id={`rec-title-${problemId}`} className="rec-problem-title">
                      {title}
                    </h3>
                    <span className={`rec-diff-badge ${formatDifficultyClass(difficulty)}`}>
                      {difficulty}
                    </span>
                  </div>

                  {tags.length > 0 && (
                    <div className="rec-tags-list" aria-label="Topics">
                      {tags.map((tag, tIdx) => (
                        <span key={tIdx} className="rec-tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rec-card-body">
                  {reason && (
                    <div className="rec-field-block">
                      <span className="rec-field-label">Why this problem</span>
                      <p className="rec-field-text">{reason}</p>
                    </div>
                  )}

                  {focus && (
                    <div className="rec-field-block">
                      <span className="rec-field-label">Focus</span>
                      <p className="rec-field-text">{focus}</p>
                    </div>
                  )}

                  {nextStep && (
                    <div className="rec-field-block">
                      <span className="rec-field-label">Next step</span>
                      <p className="rec-field-text">{nextStep}</p>
                    </div>
                  )}
                </div>

                <div className="rec-card-footer">
                  <span className="rec-match-type" title="Selection criteria">
                    {matchType}
                  </span>
                  <button
                    type="button"
                    className="rec-open-btn"
                    onClick={() => onOpenProblem(problemSlug)}
                    aria-label={`Open problem ${title}`}
                  >
                    Open Problem →
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default RecommendationsSection;
