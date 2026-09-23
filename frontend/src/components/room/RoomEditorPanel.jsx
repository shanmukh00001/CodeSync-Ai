import MonacoCodeEditor from "../MonacoCodeEditor";
import { formatLanguage } from "./formatters";

export default function RoomEditorPanel({
  room,
  code,
  onCodeChange,
  isClosed,
  codeSaving,
  lastSavedLabel,
  onSaveCode,
  isHintLoading,
  hintCooldown,
  onGetHint,
  isReviewing,
  reviewCooldown,
  onReviewCode,
  isRunning,
  isSubmitting,
  onRunCode,
  onSubmitCode,
  onResetCode,
  onCursorChange,
  remoteCursors = [],
  outputHeight,
  outputCollapsed,
  onToggleOutputCollapse,
  outputHeightDrag,
  output,
  lastExecutionStatus,
}) {
  return (
    <section className="room-editor-area">
      {/* Editor Panel Header / Actions Bar */}
      <div className="room-panel-header room-editor-header">
        <div className="room-editor-header-left">
          <span className="room-language-chip">
            {formatLanguage(room?.language)}
          </span>
          <span className="room-save-status">{lastSavedLabel}</span>
        </div>
        <div className="room-editor-header-right">
          <button
            type="button"
            className="room-save-btn"
            onClick={onSaveCode}
            disabled={codeSaving || !room || isClosed}
            aria-label="Save code draft (Ctrl+S)"
            title="Save code draft (Ctrl+S)"
          >
            {codeSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="room-hint-btn"
            onClick={onGetHint}
            disabled={isHintLoading || hintCooldown > 0 || isClosed}
            aria-label="Get Socratic AI Hint"
            title={
              isClosed
                ? "Room is closed"
                : hintCooldown > 0
                ? `Cooldown (${hintCooldown}s)`
                : "Get Socratic algorithmic guidance"
            }
          >
            {isHintLoading
              ? "Getting Hint…"
              : hintCooldown > 0
              ? `Hint (${hintCooldown}s)`
              : "Get Hint"}
          </button>
          <button
            type="button"
            className="room-review-btn"
            onClick={onReviewCode}
            disabled={isReviewing || reviewCooldown > 0 || isClosed}
            aria-label="Review code with AI"
            title={
              isClosed
                ? "Room is closed"
                : reviewCooldown > 0
                ? `Cooldown (${reviewCooldown}s)`
                : "Request static AI code review"
            }
          >
            {isReviewing
              ? "Reviewing…"
              : reviewCooldown > 0
              ? `Review (${reviewCooldown}s)`
              : "Review Code"}
          </button>
          <button
            type="button"
            className="room-run-btn"
            onClick={onRunCode}
            disabled={isRunning || isSubmitting || isClosed}
            aria-label="Run visible test cases (Ctrl+Enter)"
            title="Run visible test cases (Ctrl+Enter)"
          >
            {isRunning ? "Running…" : "Run"}
          </button>
          <button
            type="button"
            className="room-submit-btn"
            onClick={onSubmitCode}
            disabled={isRunning || isSubmitting || isClosed}
            aria-label="Submit solution (Ctrl+Shift+Enter)"
            title="Submit solution (Ctrl+Shift+Enter)"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Workspace */}
      <div className="room-editor-wrapper">
        <MonacoCodeEditor
          value={code}
          onChange={(newVal) => !isClosed && onCodeChange(newVal)}
          language={room?.language || "cpp"}
          readOnly={isClosed}
          onRunCode={onRunCode}
          onSubmitCode={onSubmitCode}
          onSave={onSaveCode}
          onReset={onResetCode}
          onCursorChange={onCursorChange}
          remoteCursors={remoteCursors}
          showLangBadge={false}
          placeholder={
            isClosed
              ? "Room is closed. Editing is disabled."
              : `Write your ${formatLanguage(room?.language)} solution here…`
          }
          showToolbar={true}
        />
      </div>

      {/* Horizontal Divider between Editor and Output */}
      {!outputCollapsed && (
        <div
          className="room-resizer room-resizer-horizontal"
          onMouseDown={outputHeightDrag.handlePointerDown}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize output panel"
          title="Drag to resize"
        >
          <span className="room-resizer-grip" aria-hidden="true" />
        </div>
      )}

      {/* Output Console Section */}
      <div
        className={`room-output-section${outputCollapsed ? " is-collapsed" : ""}`}
        style={{
          "--room-output-height": outputCollapsed ? "36px" : `${outputHeight}px`,
        }}
      >
        <div className="room-panel-header room-output-header">
          <div className="room-output-header-left">
            <h3>Output</h3>
            <button
              type="button"
              className="output-toggle-btn"
              onClick={onToggleOutputCollapse}
              aria-expanded={!outputCollapsed}
              aria-label={
                outputCollapsed ? "Expand output panel" : "Collapse output panel"
              }
              title={
                outputCollapsed ? "Expand output panel" : "Collapse output panel"
              }
            >
              {outputCollapsed ? "[Expand]" : "[Collapse]"}
            </button>
            {lastExecutionStatus ? (
              <span
                className={`room-output-status-tag ${
                  lastExecutionStatus.isSuccess ? "is-success" : "is-failed"
                }`}
              >
                {lastExecutionStatus.meta}
              </span>
            ) : (
              <span className="room-panel-meta">
                {isRunning ? "Running…" : isSubmitting ? "Submitting…" : "Idle"}
              </span>
            )}
          </div>
        </div>
        {!outputCollapsed && (
          <div className="room-output-content">
            <pre>{output}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
