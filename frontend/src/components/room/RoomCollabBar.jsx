import { useRef, useEffect } from "react";

export default function RoomCollabBar({
  linkCopied,
  onCopyLink,
  participantsOpen,
  onToggleParticipants,
  onCloseParticipants,
  participantsCount,
  room,
  currentUserId,
  user,
  discussionOpen,
  onToggleDiscussion,
  hasUnreadDiscussion = false,
}) {
  const participantsButtonRef = useRef(null);
  const participantsPopupRef = useRef(null);

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
      onCloseParticipants();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseParticipants();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [participantsOpen, onCloseParticipants]);

  return (
    <div
      className="room-collab-bar"
      role="toolbar"
      aria-label="Room collaboration"
    >
      <div className="room-collab-left">
        <span className="room-collab-link-text">Room link</span>
        <button
          type="button"
          className={`room-collab-copy-btn${linkCopied ? " is-copied" : ""}`}
          onClick={onCopyLink}
          aria-label="Copy room link"
        >
          {linkCopied ? "Copied" : "Copy Link"}
        </button>
      </div>

      <div className="room-collab-right">
        <div className="room-collab-participants-wrap">
          <button
            ref={participantsButtonRef}
            type="button"
            className="room-collab-btn"
            onClick={onToggleParticipants}
            aria-haspopup="dialog"
            aria-expanded={participantsOpen}
            aria-label="Toggle participants list"
          >
            {participantsCount} Participants{" "}
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

        <button
          type="button"
          className={`room-collab-btn room-collab-discussion-btn${
            discussionOpen ? " is-active" : ""
          }`}
          onClick={onToggleDiscussion}
          aria-pressed={discussionOpen}
          aria-label="Toggle discussion drawer"
        >
          Discussion
          {hasUnreadDiscussion && !discussionOpen && (
            <span className="room-unread-dot" aria-label="Unread messages" />
          )}
        </button>
      </div>
    </div>
  );
}
