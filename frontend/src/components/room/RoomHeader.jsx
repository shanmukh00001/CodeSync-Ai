export default function RoomHeader({
  room,
  participantsCount,
  leaving,
  leaveError,
  onLeave,
  isHost,
  isClosed,
  ending,
  endError,
  onEnd,
  onBack,
}) {
  return (
    <header className="dashboard-header room-header">
      <div
        className="dashboard-brand"
        onClick={onBack}
        style={{ cursor: "pointer" }}
      >
        <span className="dashboard-brand-mark">CS</span>
        <span className="dashboard-brand-title">CodeSync AI</span>
      </div>

      <div className="room-header-center">
        <div className="room-header-room">
          <span className="room-header-label">Room</span>
          <span className="room-header-name">
            {room?.roomName || "Loading…"}
          </span>
          {isClosed && <span className="room-closed-badge">Closed</span>}
        </div>
        <div className="room-header-meta">
          <span className="room-header-participants">
            {participantsCount}/3 participants
          </span>
        </div>
      </div>

      <div className="room-header-actions">
        {leaveError && (
          <span className="room-leave-error" title={leaveError}>
            {leaveError}
          </span>
        )}
        {endError && (
          <span className="room-leave-error" title={endError}>
            {endError}
          </span>
        )}
        <button
          type="button"
          className="room-back-btn"
          onClick={onBack}
        >
          ← Dashboard
        </button>
        {isHost && !isClosed && (
          <button
            type="button"
            className="room-end-btn"
            onClick={onEnd}
            disabled={ending || leaving}
            title="End this room for all participants"
          >
            {ending ? "Ending…" : "End Room"}
          </button>
        )}
        <button
          type="button"
          className="room-leave-btn"
          onClick={onLeave}
          disabled={leaving || ending}
        >
          {leaving ? "Leaving…" : "Leave Room"}
        </button>
      </div>
    </header>
  );
}
