import { useRef, useEffect } from "react";

export default function RoomProblemPicker({
  isOpen,
  onToggle,
  onClose,
  activeProblem,
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
  const pickerButtonRef = useRef(null);
  const pickerPopupRef = useRef(null);
  const pickerSearchInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    const focusTimer = setTimeout(() => {
      pickerSearchInputRef.current?.focus();
    }, 50);

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        pickerPopupRef.current?.contains(target) ||
        pickerButtonRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const filteredProblems = problems.filter((problem) => {
    const matchesSearch = problem.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesDifficulty =
      difficulty === "All" || problem.difficulty === difficulty;
    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="room-problem-control-bar">
      <button
        ref={pickerButtonRef}
        type="button"
        className={`room-problem-search-btn ${isOpen ? "is-open" : ""}`}
        onClick={() => !isClosed && onToggle()}
        disabled={isClosed}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label="Select a problem for this room"
      >
        <span className="room-problem-search-icon" aria-hidden="true">
          🔍
        </span>
        <span className="room-problem-search-text">
          {activeProblem
            ? activeProblem.title
            : "Select a challenge for this room…"}
        </span>
        <span className="room-problem-search-chevron" aria-hidden="true">
          {isOpen ? "▲" : "▼"}
        </span>
      </button>

      {isOpen && (
        <div
          ref={pickerPopupRef}
          className="room-problem-picker-popup"
          role="dialog"
          aria-label="Select a problem"
        >
          <div className="room-picker-search-header">
            <input
              ref={pickerSearchInputRef}
              type="text"
              className="room-picker-search-input"
              placeholder="Search problems by name…"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label="Search problems"
            />
            <select
              className="room-picker-difficulty-select"
              value={difficulty}
              onChange={(e) => onDifficultyChange(e.target.value)}
              aria-label="Filter by difficulty"
            >
              <option value="All">All</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>

          <div className="room-picker-list">
            {problemsLoading ? (
              <p className="room-muted">Loading problems…</p>
            ) : problemsError ? (
              <p className="room-muted room-muted-error">
                {problemsError}
              </p>
            ) : filteredProblems.length === 0 ? (
              <p className="room-muted">
                No problems match your search.
              </p>
            ) : (
              filteredProblems.map((p) => {
                const isCurrentActive = activeProblem?._id === p._id;
                return (
                  <button
                    key={p._id}
                    type="button"
                    disabled={selectingProblem}
                    className={`room-picker-item ${
                      isCurrentActive ? "is-selected" : ""
                    }`}
                    onClick={() => {
                      onSelectProblem(p);
                      onClose();
                    }}
                  >
                    <div className="room-picker-item-info">
                      <span className="room-picker-item-title">
                        {p.title}
                      </span>
                      {isCurrentActive && (
                        <span className="room-picker-item-current">
                          Selected
                        </span>
                      )}
                    </div>
                    <span
                      className={`room-problem-difficulty room-difficulty-${p.difficulty?.toLowerCase()}`}
                    >
                      {p.difficulty}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
