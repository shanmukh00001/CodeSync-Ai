import { useState, useRef, useCallback, useEffect } from "react";
import MonacoCodeEditor from "../MonacoCodeEditor";
import { formatLanguage } from "./formatters";

// Exactly matching ProblemWorkspace constants
const MIN_OUTPUT_HEIGHT = 100;
const MIN_EDITOR_HEIGHT = 120;
const DEFAULT_OUTPUT_HEIGHT = 220;
const LS_OUTPUT_HEIGHT = "codesync-room-output-panel-height";
const COLLAPSED_HEIGHT = 34;

export default function RoomEditorPanel({
  editorPanelRef,
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
  outputCollapsed,
  onToggleOutputCollapse,
  output,
  lastExecutionStatus,
  /* ── Collab bar props ── */
  linkCopied,
  onCopyLink,
  participantsOpen,
  onToggleParticipants,
  onCloseParticipants,
  participantsCount,
  currentUserId,
  user,
  discussionOpen,
  onToggleDiscussion,
  hasUnreadDiscussion,
}) {
  const [showFeatures, setShowFeatures] = useState(false);
  const sectionRef = useRef(null);
  const participantsButtonRef = useRef(null);
  const participantsPopupRef = useRef(null);
  const dragStateRef = useRef(null);

  // Height state initialized from localStorage, exactly like ProblemWorkspace
  const [outputHeight, setOutputHeight] = useState(() => {
    try {
      const stored = localStorage.getItem(LS_OUTPUT_HEIGHT);
      if (stored !== null) {
        const val = Number(stored);
        if (!isNaN(val) && val >= MIN_OUTPUT_HEIGHT) return val;
      }
    } catch {}
    return DEFAULT_OUTPUT_HEIGHT;
  });

  // Persist height changes to localStorage, exactly like ProblemWorkspace
  useEffect(() => {
    try {
      localStorage.setItem(LS_OUTPUT_HEIGHT, String(outputHeight));
    } catch {}
  }, [outputHeight]);

  // Close participants popup on outside click or Escape
  useEffect(() => {
    if (!participantsOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        participantsPopupRef.current?.contains(target) ||
        participantsButtonRef.current?.contains(target)
      ) {
        return;
      }
      onCloseParticipants?.();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseParticipants?.();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [participantsOpen, onCloseParticipants]);

  // ── Drag logic matching ProblemWorkspace exactly ──
  const handlePointerMove = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state || state.mode !== "horizontal") return;

    const panel = sectionRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const panelBottom = rect.bottom;
    // Distance from cursor to the bottom of the editor section is the output height.
    const rawHeight = panelBottom - event.clientY;
    const maxHeight = rect.height - MIN_EDITOR_HEIGHT;
    const clamped = Math.min(
      maxHeight,
      Math.max(MIN_OUTPUT_HEIGHT, rawHeight)
    );
    setOutputHeight(clamped);
  }, []);

  const handlePointerUp = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state) return;
    try {
      event.target.releasePointerCapture(event.pointerId);
    } catch {}
    dragStateRef.current = null;
    document.body.classList.remove("room-dragging");
  }, []);

  const startHorizontalDrag = useCallback((event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    dragStateRef.current = { mode: "horizontal" };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {}
    document.body.classList.add("room-dragging");
  }, []);

  // Safety net: if pointer is released anywhere outside the handle, clean up drag state
  useEffect(() => {
    const cancelDrag = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      document.body.classList.remove("room-dragging");
    };
    window.addEventListener("pointerup", cancelDrag);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointerup", cancelDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      document.body.classList.remove("room-dragging");
    };
  }, []);

  return (
    <section
      className="room-editor-area"
      ref={(el) => {
        sectionRef.current = el;
        if (editorPanelRef) editorPanelRef.current = el;
      }}
    >
      {/* ── Editor Header ── */}
      <div className="room-panel-header room-editor-header">
        <div className="room-editor-header-left">
          <span className="room-language-chip">{formatLanguage(room?.language)}</span>
          <span className="room-save-status">{lastSavedLabel}</span>
        </div>
        <div className="room-editor-header-right">
          <button
            type="button"
            className={`room-features-btn ${showFeatures ? "is-active" : ""}`}
            onClick={() => setShowFeatures((prev) => !prev)}
            aria-expanded={showFeatures}
            title="Toggle editor features"
          >
            ⚡ Features {showFeatures ? "▲" : "▼"}
          </button>
          <button
            type="button"
            className="room-save-btn"
            onClick={onSaveCode}
            disabled={codeSaving || !room || isClosed}
            title="Save (Ctrl+S)"
          >
            {codeSaving ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            className="room-hint-btn"
            onClick={onGetHint}
            disabled={isHintLoading || hintCooldown > 0 || isClosed}
            title={hintCooldown > 0 ? `Cooldown (${hintCooldown}s)` : "Get Hint"}
          >
            {isHintLoading ? "Getting Hint…" : hintCooldown > 0 ? `Hint (${hintCooldown}s)` : "Get Hint"}
          </button>
          <button
            type="button"
            className="room-review-btn"
            onClick={onReviewCode}
            disabled={isReviewing || reviewCooldown > 0 || isClosed}
            title={reviewCooldown > 0 ? `Cooldown (${reviewCooldown}s)` : "Review Code"}
          >
            {isReviewing ? "Reviewing…" : reviewCooldown > 0 ? `Review (${reviewCooldown}s)` : "Review Code"}
          </button>
          <button
            type="button"
            className="room-run-btn"
            onClick={onRunCode}
            disabled={isRunning || isSubmitting || isClosed}
            title="Run (Ctrl+Enter)"
          >
            {isRunning ? "Running…" : "Run"}
          </button>
          <button
            type="button"
            className="room-submit-btn"
            onClick={onSubmitCode}
            disabled={isRunning || isSubmitting || isClosed}
            title="Submit (Ctrl+Shift+Enter)"
          >
            {isSubmitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>

      {/* ── Monaco Editor ── */}
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
          showToolbar={showFeatures}
        />
      </div>

      {/* ── Horizontal Drag Handle (identical to ProblemWorkspace) ── */}
      {!outputCollapsed && (
        <div
          className="resize-handle resize-handle-horizontal room-resizer-horizontal"
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize editor and output panels"
          onPointerDown={startHorizontalDrag}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        />
      )}

      {/* ── Output Panel (identical structure & classes to ProblemWorkspace) ── */}
      <div
        className={`output-panel room-output-section${outputCollapsed ? " is-collapsed" : ""}`}
        style={{
          height: `${outputCollapsed ? COLLAPSED_HEIGHT : outputHeight}px`,
        }}
      >
        {/* Output Header matching ProblemWorkspace */}
        <div className="output-header room-output-header">
          <div className="output-header-left">
            <span className="output-title">OUTPUT</span>
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

          <div className="output-header-right">
            {/* Room Link pill */}
            <div className="room-collab-link-pill">
              <span className="room-collab-link-label">ROOM LINK</span>
              <button
                type="button"
                className={`room-collab-copy-btn${linkCopied ? " is-copied" : ""}`}
                onClick={onCopyLink}
                aria-label="Copy room link"
              >
                {linkCopied ? "✓ Copied" : "Copy Link"}
              </button>
            </div>

            <span className="room-collab-divider" aria-hidden="true" />

            {/* Participants dropdown */}
            <div className="room-collab-participants-wrap">
              <button
                ref={participantsButtonRef}
                type="button"
                className={`room-collab-btn${participantsOpen ? " is-active" : ""}`}
                onClick={onToggleParticipants}
                aria-haspopup="dialog"
                aria-expanded={participantsOpen}
                aria-label="Toggle participants list"
              >
                👥 {participantsCount} Participants{" "}
                <span className="room-colbar-caret" aria-hidden="true">
                  {participantsOpen ? "▲" : "▼"}
                </span>
              </button>

              {participantsOpen && (
                <div
                  ref={participantsPopupRef}
                  className="room-participants-popup"
                  role="dialog"
                  aria-label="Participants in this room"
                >
                  <div className="room-participants-header">
                    <span className="room-participants-title">
                      Room Members ({participantsCount}/3)
                    </span>
                  </div>
                  <ul className="room-participants-list">
                    {Array.isArray(room?.users) && room.users.length > 0 ? (
                      room.users.map((u, idx) => {
                        const uid = u?._id || u?.id || u;
                        const isSelf =
                          currentUserId && String(uid) === String(currentUserId);
                        const displayName =
                          (isSelf ? user?.name || u?.name : u?.name) ||
                          u?.username ||
                          (isSelf ? "You" : `Participant ${idx + 1}`);

                        return (
                          <li key={uid || idx} className="room-participant-item">
                            <div className="room-participant-info">
                              <div className="room-participant-name">
                                {isSelf ? `${displayName} (You)` : displayName}
                              </div>
                              <div className="room-participant-status">
                                <span
                                  className="room-participant-dot"
                                  aria-hidden="true"
                                />
                                Online
                              </div>
                            </div>
                          </li>
                        );
                      })
                    ) : (
                      <li className="room-participant-item">
                        <div className="room-participant-info">
                          <div className="room-participant-name">
                            {user?.name || "You"} (You)
                          </div>
                          <div className="room-participant-status">
                            <span
                              className="room-participant-dot"
                              aria-hidden="true"
                            />
                            Online
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {/* Discussion Button */}
            <button
              type="button"
              className={`room-collab-btn room-collab-discussion-btn${
                discussionOpen ? " is-active" : ""
              }`}
              onClick={onToggleDiscussion}
              aria-pressed={discussionOpen}
              aria-label="Toggle discussion drawer"
            >
              💬 Discussion
              {hasUnreadDiscussion && !discussionOpen && (
                <span className="room-unread-dot" aria-label="Unread messages" />
              )}
            </button>

            <span className="room-collab-divider" aria-hidden="true" />

            {/* Collapse / Expand toggle button (on far right, identical to ProblemWorkspace) */}
            <button
              type="button"
              className="output-toggle-btn"
              onClick={onToggleOutputCollapse}
              aria-expanded={!outputCollapsed}
              aria-label={outputCollapsed ? "Expand output panel" : "Collapse output panel"}
              title={outputCollapsed ? "Expand output panel" : "Collapse output panel"}
            >
              {outputCollapsed ? "▲ Expand" : "▼ Collapse"}
            </button>
          </div>
        </div>

        {/* Output Console Log Content */}
        {!outputCollapsed && (
          <div className="output-content room-output-content">
            <pre>{output}</pre>
          </div>
        )}
      </div>
    </section>
  );
}
