import SubmissionsView from "../SubmissionsView";
import AIReviewPanel from "../AIReviewPanel";
import AIHintPanel from "../AIHintPanel";
import RoomProblemPicker from "./RoomProblemPicker";

export default function RoomProblemPanel({
  problemWidth,
  leftPanelTab,
  onTabChange,
  isCreator,
  activeProblem,
  room,
  submissionHistoryVersion,
  aiReview,
  isReviewing,
  aiReviewError,
  aiHint,
  isHintLoading,
  aiHintError,
  problemSelectError,
  pickerOpen,
  onTogglePicker,
  onClosePicker,
  problems,
  problemsLoading,
  problemsError,
  search,
  onSearchChange,
  difficulty,
  onDifficultyChange,
  onSelectProblem,
  selectingProblem,
  isClosed,
}) {
  return (
    <section
      className="room-problems-panel"
      style={{ "--room-problems-width": `${problemWidth}px` }}
    >
      <div className="room-panel-header room-tabs-header">
        <div className="room-nav-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelTab === "problem"}
            className={`room-tab-btn ${
              leftPanelTab === "problem" ? "is-active" : ""
            }`}
            onClick={() => onTabChange("problem")}
          >
            Problem
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelTab === "submissions"}
            className={`room-tab-btn ${
              leftPanelTab === "submissions" ? "is-active" : ""
            }`}
            onClick={() => onTabChange("submissions")}
          >
            Submissions
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelTab === "review"}
            className={`room-tab-btn ${
              leftPanelTab === "review" ? "is-active" : ""
            }`}
            onClick={() => onTabChange("review")}
          >
            AI Review
            {aiReview && !isReviewing && !aiReviewError && (
              <span className="room-tab-dot" aria-label="Review available" />
            )}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={leftPanelTab === "hint"}
            className={`room-tab-btn ${
              leftPanelTab === "hint" ? "is-active" : ""
            }`}
            onClick={() => onTabChange("hint")}
          >
            AI Hint
            {aiHint && !isHintLoading && !aiHintError && (
              <span className="room-tab-dot" aria-label="Hint available" />
            )}
          </button>
        </div>
        <span className="room-panel-meta">
          {isCreator ? "Creator" : "Participant"}
        </span>
      </div>

      {leftPanelTab === "submissions" ? (
        <div className="room-submissions-container">
          <SubmissionsView
            problemId={activeProblem?._id}
            currentLanguage={room?.language || "cpp"}
            refreshTrigger={submissionHistoryVersion}
          />
        </div>
      ) : leftPanelTab === "review" ? (
        <div className="room-review-container">
          <AIReviewPanel
            review={aiReview}
            loading={isReviewing}
            error={aiReviewError}
            onClose={() => onTabChange("problem")}
          />
        </div>
      ) : leftPanelTab === "hint" ? (
        <div className="room-review-container">
          <AIHintPanel
            hint={aiHint}
            loading={isHintLoading}
            error={aiHintError}
            onClose={() => onTabChange("problem")}
          />
        </div>
      ) : (
        <>
          {problemSelectError && (
            <div
              className="room-problem-select-error"
              style={{
                padding: "8px 14px",
                color: "#fca5a5",
                fontSize: "0.8rem",
                background: "rgba(248, 113, 113, 0.1)",
                borderBottom: "1px solid rgba(248, 113, 113, 0.2)",
              }}
            >
              {problemSelectError}
            </div>
          )}

          {isCreator && (
            <RoomProblemPicker
              isOpen={pickerOpen}
              onToggle={onTogglePicker}
              onClose={onClosePicker}
              activeProblem={activeProblem}
              problems={problems}
              problemsLoading={problemsLoading}
              problemsError={problemsError}
              search={search}
              onSearchChange={onSearchChange}
              difficulty={difficulty}
              onDifficultyChange={onDifficultyChange}
              onSelectProblem={onSelectProblem}
              selectingProblem={selectingProblem}
              isClosed={isClosed}
            />
          )}

          <div className="room-problem-details">
            {activeProblem ? (
              <>
                <div className="room-problem-details-header">
                  <h2 className="room-problem-details-title">
                    {activeProblem.title}
                  </h2>
                  <span
                    className={`room-problem-difficulty room-difficulty-${activeProblem.difficulty?.toLowerCase()}`}
                  >
                    {activeProblem.difficulty}
                  </span>
                </div>

                {Array.isArray(activeProblem.tags) &&
                  activeProblem.tags.length > 0 && (
                    <div className="room-problem-tag-list">
                      {activeProblem.tags.map((tag, idx) => (
                        <span key={idx} className="room-problem-tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                {activeProblem.description && (
                  <div className="room-problem-section">
                    <h3 className="room-problem-section-title">Description</h3>
                    <div className="room-problem-description">
                      {activeProblem.description}
                    </div>
                  </div>
                )}

                {Array.isArray(activeProblem.examples) &&
                  activeProblem.examples.length > 0 && (
                    <div className="room-problem-section">
                      <h3 className="room-problem-section-title">Examples</h3>
                      {activeProblem.examples.map((ex, idx) => (
                        <div key={idx} className="room-problem-example">
                          <div className="room-problem-example-header">
                            Example {idx + 1}
                          </div>
                          <div className="room-problem-example-body">
                            {ex.input && (
                              <p>
                                <strong>Input:</strong> <code>{ex.input}</code>
                              </p>
                            )}
                            {ex.output && (
                              <p>
                                <strong>Output:</strong> <code>{ex.output}</code>
                              </p>
                            )}
                            {ex.explanation && (
                              <p>
                                <strong>Explanation:</strong> {ex.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {Array.isArray(activeProblem.constraints) &&
                  activeProblem.constraints.length > 0 && (
                    <div className="room-problem-section">
                      <h3 className="room-problem-section-title">
                        Constraints
                      </h3>
                      <ul className="room-problem-constraints">
                        {activeProblem.constraints.map((c, idx) => (
                          <li key={idx}>
                            <code>{c}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </>
            ) : isCreator ? (
              <div className="room-problem-empty-creator">
                <h4>No Problem Selected</h4>
                <p>
                  Click the problem search bar above to choose a challenge for your room.
                </p>
                <button
                  type="button"
                  className="room-empty-select-btn"
                  onClick={onTogglePicker}
                >
                  Select Problem
                </button>
              </div>
            ) : (
              <div className="room-problem-empty-participant">
                <h4>Waiting for Problem</h4>
                <p>
                  Waiting for the room creator to select a challenge. Once chosen,
                  the problem statement and starter code will synchronize automatically.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
