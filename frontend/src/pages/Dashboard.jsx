import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import ActivityHeatmap from "../components/ActivityHeatmap";
import "./Dashboard.css";

const LANGUAGE_LABELS = {
  cpp: "C++",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
};

const formatLanguage = (code) =>
  LANGUAGE_LABELS[code] || (code ? code.toUpperCase() : "—");

function Dashboard() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState([]);
  const [solvedProblemIds, setSolvedProblemIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  // State for difficulty filter
  const [difficulty, setDifficulty] = useState("All");

  // Personal Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

  const [roomMode, setRoomMode] = useState(null);
  const [roomName, setRoomName] = useState("");
  const [roomLanguage, setRoomLanguage] = useState("cpp");
  const [joinRoomId, setJoinRoomId] = useState("");
  const [roomError, setRoomError] = useState("");
  const [roomLoading, setRoomLoading] = useState(false);

  // Fetch personal analytics overview
  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch("http://localhost:5000/api/users/analytics", {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.analytics) {
          setAnalytics(data.analytics);
        }
      } else {
        setAnalyticsError("Could not load analytics summary");
      }
    } catch {
      setAnalyticsError("Network error loading analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // Fetch problems and solved status
  useEffect(() => {
    const fetchProblemsAndSolved = async () => {
      try {
        const [problemsRes, solvedRes] = await Promise.allSettled([
          fetch("http://localhost:5000/api/problems"),
          fetch("http://localhost:5000/api/users/solved-problems", { credentials: "include" })
        ]);

        if (problemsRes.status === "fulfilled") {
          const data = await problemsRes.value.json();
          if (problemsRes.value.ok && Array.isArray(data.problems)) {
            setProblems(data.problems);
          } else {
            setError(data?.error?.message || data?.message || "Failed to fetch problems");
          }
        } else {
          setError("Failed to fetch problems");
        }

        if (solvedRes.status === "fulfilled" && solvedRes.value.ok) {
          const solvedData = await solvedRes.value.json();
          if (Array.isArray(solvedData.solvedProblems)) {
            const idSet = new Set(solvedData.solvedProblems.map((p) => String(p._id)));
            setSolvedProblemIds(idSet);
          }
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProblemsAndSolved();
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Close any open room modal on Escape
  useEffect(() => {
    if (!roomMode) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setRoomMode(null);
        setRoomError("");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [roomMode]);

  // Lock background scroll while a modal is open
  useEffect(() => {
    if (!roomMode) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [roomMode]);

  // Open the create room modal and reset its state
  const openCreateRoomModal = () => {
    setRoomName("");
    setRoomLanguage("cpp");
    setRoomError("");
    setRoomMode("create");
  };

  // Open the join room modal and reset its state
  const openJoinRoomModal = () => {
    setJoinRoomId("");
    setRoomError("");
    setRoomMode("join");
  };

  // Close a modal and reset its state
  const closeRoomModal = () => {
    setRoomMode(null);
    setRoomError("");
  };

  // ================= ACTIVE ROOM =================
  const [activeRoom, setActiveRoom] = useState(null);
  const [activeRoomLoading, setActiveRoomLoading] = useState(true);
  const [activeRoomError, setActiveRoomError] = useState("");
  const [leavingRoom, setLeavingRoom] = useState(false);

  // ================= RECENT ROOMS =================
  const [recentRooms, setRecentRooms] = useState([]);
  const [recentRoomsLoading, setRecentRoomsLoading] = useState(true);

  // Fetch recent rooms (top 2 recently joined)
  const fetchRecentRooms = useCallback(async () => {
    setRecentRoomsLoading(true);
    try {
      const response = await fetch(
        "http://localhost:5000/api/users/recent-rooms",
        { credentials: "include" }
      );
      if (response.ok) {
        const data = await response.json();
        setRecentRooms(data.recentRooms || []);
      }
    } catch {
      // Ignore errors silently for secondary list
    } finally {
      setRecentRoomsLoading(false);
    }
  }, []);

  // Fetch the user's current room (from /api/users/me -> activeRoom) and
  // then load the room details (name, language) from /api/rooms/:roomId.
  const fetchActiveRoom = useCallback(async () => {
    setActiveRoomLoading(true);
    setActiveRoomError("");

    try {
      const meResponse = await fetch(
        "http://localhost:5000/api/users/me",
        { credentials: "include" }
      );

      if (!meResponse.ok) {
        throw new Error("Failed to load user profile");
      }

      const meData = await meResponse.json();
      const roomId = meData?.activeRoom;

      if (!roomId) {
        setActiveRoom(null);
        return;
      }

      const roomResponse = await fetch(
        `http://localhost:5000/api/rooms/${roomId}`,
        { credentials: "include" }
      );

      if (!roomResponse.ok) {
        // User is marked as in a room, but they aren't a member (e.g. room
        // was deleted, or they were removed). Clear it locally so the UI
        // doesn't get stuck showing a stale active room.
        setActiveRoom({ roomId, stale: true });
        return;
      }

      const roomData = await roomResponse.json();
      setActiveRoom({ ...roomData.room, stale: false });
    } catch (err) {
      setActiveRoomError(err.message);
    } finally {
      setActiveRoomLoading(false);
    }
  }, []);

  // Refetch on mount
  useEffect(() => {
    fetchActiveRoom();
    fetchRecentRooms();
  }, [fetchActiveRoom, fetchRecentRooms]);

  // Leave the currently active room
  const handleLeaveActiveRoom = async () => {
    if (!activeRoom?.roomId || leavingRoom) return;

    setLeavingRoom(true);
    setActiveRoomError("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${activeRoom.roomId}/leave`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to leave room"
        );
      }

      setActiveRoom(null);
      fetchRecentRooms();
    } catch (err) {
      setActiveRoomError(err.message);
    } finally {
      setLeavingRoom(false);
    }
  };

  // Create room
  const handleCreateRoom = async (e) => {
    e.preventDefault();

    if (!roomName.trim()) {
      setRoomError("Room name is required.");
      return;
    }

    setRoomLoading(true);
    setRoomError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/rooms/create",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            roomName: roomName.trim(),
            language: roomLanguage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to create room"
        );
      }

      closeRoomModal();
      navigate(`/room/${data.room.roomId}`);
    } catch (err) {
      setRoomError(err.message);
    } finally {
      setRoomLoading(false);
    }
  };

  // Join room
  const handleJoinRoom = async (e) => {
    e.preventDefault();

    if (!joinRoomId.trim()) {
      setRoomError("Room ID is required.");
      return;
    }

    setRoomLoading(true);
    setRoomError("");

    try {
      const response = await fetch(
        "http://localhost:5000/api/rooms/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            roomId: joinRoomId.trim(),
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to join room"
        );
      }

      closeRoomModal();
      navigate(`/room/${data.room.roomId}`);
    } catch (err) {
      setRoomError(err.message);
    } finally {
      setRoomLoading(false);
    }
  };
  // Rejoin a room from the Recent Rooms card
  const handleRejoinRecentRoom = async (roomId) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/rooms/join",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ roomId }),
        }
      );

      const data = await response.json();

      if (response.ok || data?.message === "User is already in the room") {
        navigate(`/room/${roomId}`);
      } else {
        // If room is full or error, navigate directly to let Room page show message
        navigate(`/room/${roomId}`);
      }
    } catch {
      navigate(`/room/${roomId}`);
    }
  };
  const filteredProblems = problems.filter((problem) => {
    const matchesSearch = problem.title
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesDifficulty =
      difficulty === "All" ||
      problem.difficulty === difficulty;

    return matchesSearch && matchesDifficulty;
  });

  return (
    <div className="dashboard">

      {/* ================= HEADER ================= */}
      <header className="dashboard-header">
        <div className="dashboard-brand">
          <span className="dashboard-brand-mark">CS</span>
          <span className="dashboard-brand-title">CodeSync AI</span>
        </div>

        <button
          type="button"
          className="dashboard-profile-btn"
          onClick={() => navigate("/profile")}
          aria-label="View user profile"
        >
          <span className="profile-label">Profile</span>
          <div className="profile-avatar-chip">
            USR
          </div>
        </button>
      </header>


      {/* ================= MAIN CONTENT ================= */}
      <main className="dashboard-content">

        {/* ================= ANALYTICS OVERVIEW SECTION ================= */}
        <section className="dashboard-analytics-section" aria-label="Personal Coding Progress Overview">
          {analyticsError && (
            <div className="dashboard-analytics-error" role="alert">
              <span>{analyticsError}</span>
              <button
                type="button"
                className="dashboard-retry-btn"
                onClick={fetchAnalytics}
              >
                Retry
              </button>
            </div>
          )}

          {/* Primary Overview Metrics: Solved, Submissions, Streak */}
          <div className="dashboard-overview-grid">
            {/* Solved Problems Summary */}
            <div className="dashboard-metric-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">PROBLEMS SOLVED</span>
                <span className="dashboard-card-tag">PROGRESS</span>
              </div>
              <div className="dashboard-metric-main">
                <span className="dashboard-metric-number dashboard-accent-num">
                  {analyticsLoading ? "…" : analytics?.solved?.totalSolved ?? 0}
                </span>
                <span className="dashboard-metric-subtext">Total solved</span>
              </div>
              <div className="dashboard-diff-chips">
                <div className="diff-chip diff-chip-easy">
                  <span className="diff-chip-label">EASY</span>
                  <span className="diff-chip-val">
                    {analyticsLoading ? "…" : analytics?.solved?.easy ?? 0}
                  </span>
                </div>
                <div className="diff-chip diff-chip-medium">
                  <span className="diff-chip-label">MED</span>
                  <span className="diff-chip-val">
                    {analyticsLoading ? "…" : analytics?.solved?.medium ?? 0}
                  </span>
                </div>
                <div className="diff-chip diff-chip-hard">
                  <span className="diff-chip-label">HARD</span>
                  <span className="diff-chip-val">
                    {analyticsLoading ? "…" : analytics?.solved?.hard ?? 0}
                  </span>
                </div>
              </div>
            </div>

            {/* Submissions & Acceptance Summary */}
            <div className="dashboard-metric-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">SUBMISSIONS</span>
                <span className="dashboard-card-tag">EVALUATION</span>
              </div>
              <div className="dashboard-metric-main">
                <span className="dashboard-metric-number">
                  {analyticsLoading ? "…" : analytics?.submissions?.total ?? 0}
                </span>
                <span className="dashboard-metric-subtext">Total attempts</span>
              </div>
              <div className="dashboard-stat-row">
                <div className="stat-item">
                  <span className="stat-label">ACCEPTED</span>
                  <span className="stat-value text-accepted">
                    {analyticsLoading ? "…" : analytics?.submissions?.accepted ?? 0}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">SUCCESS RATE</span>
                  <span className="stat-value">
                    {analyticsLoading ? "…" : `${analytics?.submissions?.acceptanceRate ?? 0}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* Streak & Consistency Summary */}
            <div className="dashboard-metric-card">
              <div className="dashboard-card-header">
                <span className="dashboard-card-title">CODING STREAK</span>
                <span className="dashboard-card-tag">CADENCE</span>
              </div>
              <div className="dashboard-metric-main">
                <span className="dashboard-metric-number text-streak">
                  {analyticsLoading ? "…" : `${analytics?.activity?.currentStreak ?? 0}d`}
                </span>
                <span className="dashboard-metric-subtext">Current streak</span>
              </div>
              <div className="dashboard-stat-row">
                <div className="stat-item">
                  <span className="stat-label">BEST STREAK</span>
                  <span className="stat-value">
                    {analyticsLoading ? "…" : `${analytics?.activity?.longestStreak ?? 0}d`}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">STATUS</span>
                  <span className="stat-value text-status">
                    {analyticsLoading
                      ? "…"
                      : (analytics?.activity?.currentStreak ?? 0) > 0
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Activity Heatmap Card */}
          <div className="dashboard-activity-panel">
            <div className="dashboard-activity-header">
              <div className="dashboard-activity-title-group">
                <h3>Submission Activity</h3>
                <span className="dashboard-activity-subtitle">Last 12 weeks cadence</span>
              </div>
              <button
                type="button"
                className="dashboard-analytics-link"
                onClick={() => navigate("/profile")}
                aria-label="View detailed analytics on profile"
              >
                Full Analytics →
              </button>
            </div>
            <ActivityHeatmap
              activity={analytics?.activity}
              loading={analyticsLoading}
            />
          </div>
        </section>

        {/* ================= PROBLEMS SECTION ================= */}
        <section className="problems-section">

          <div className="problems-header">
            <div>
              <h2>Problems</h2>
              <p className="problems-subtitle">
                Practice and solve coding challenges
              </p>
            </div>

            <div className="problem-filters">

              {/* Search */}
              <input
                type="text"
                placeholder="Search problems..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              {/* Difficulty filter */}
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              >
                <option value="All">
                  All Difficulties
                </option>

                <option value="Easy">
                  Easy
                </option>

                <option value="Medium">
                  Medium
                </option>

                <option value="Hard">
                  Hard
                </option>
              </select>

            </div>
          </div>


          {/* ================= PROBLEMS TABLE ================= */}
          <div className="problems-table-container">

            {loading ? (

              <p className="loading-message">
                Loading problems...
              </p>

            ) : error ? (

              <p className="error-message">
                {error}
              </p>

            ) : (

              <table className="problems-table">

                <thead>
                  <tr>
                    <th>Status</th>
                    <th>#</th>
                    <th>Problem</th>
                    <th>Difficulty</th>
                  </tr>
                </thead>


                <tbody>

                  {filteredProblems.length > 0 ? (

                    filteredProblems.map((problem, index) => (

                      <tr key={problem._id}>

                        {/* Status */}
                        <td>
                          {solvedProblemIds.has(String(problem._id)) ? (
                            <span
                              className="solved-icon"
                              title="Solved"
                            >
                              ✓
                            </span>
                          ) : (
                            <span
                              className="unsolved-icon"
                              title="Not solved"
                            >
                              ○
                            </span>
                          )}
                        </td>


                        {/* Problem number */}
                        <td>
                          {index + 1}
                        </td>


                        {/* Problem title */}
                        <td
                          className="problem-title"
                          onClick={() => navigate(`/problems/${problem.slug}`)}
                        >
                          {problem.title}
                        </td>


                        {/* Difficulty */}
                        <td>

                          <span
                            className={
                              problem.difficulty === "Easy"
                                ? "easy"
                                : problem.difficulty === "Medium"
                                ? "medium"
                                : "hard"
                            }
                          >
                            {problem.difficulty}
                          </span>

                        </td>

                      </tr>

                    ))

                  ) : (

                    <tr>
                      <td
                        colSpan="4"
                        className="no-problems"
                      >
                        No problems found
                      </td>
                    </tr>

                  )}

                </tbody>

              </table>

            )}

          </div>

        </section>


        {/* ================= ROOMS SECTION ================= */}
        <aside className="rooms-section">

          {/* Active room */}
          <div className="active-room">

            <div className="section-title">
              <h2>Active Room</h2>
              <span
                className={`status-dot ${
                  activeRoom && !activeRoom.stale ? "status-dot-active" : "status-dot-inactive"
                }`}
              ></span>
            </div>

            {activeRoomLoading ? (
              <div className="empty-room">
                <p>Loading active room…</p>
              </div>
            ) : activeRoom && !activeRoom.stale ? (
              <div className="active-room-content">
                <button
                  type="button"
                  className="active-room-card"
                  onClick={() => navigate(`/room/${activeRoom.roomId}`)}
                >
                  <div className="active-room-name">
                    {activeRoom.roomName || "Untitled room"}
                  </div>
                  <div className="active-room-meta">
                    <span className="active-room-language">
                      {formatLanguage(activeRoom.language)}
                    </span>
                    <span className="active-room-participants">
                      {Array.isArray(activeRoom.users)
                        ? `${activeRoom.users.length}/3`
                        : "1/3"}
                    </span>
                  </div>
                  <div
                    className="active-room-id"
                    title={activeRoom.roomId}
                  >
                    ID: {activeRoom.roomId}
                  </div>
                </button>

                <button
                  type="button"
                  className="leave-room-btn"
                  onClick={handleLeaveActiveRoom}
                  disabled={leavingRoom}
                >
                  {leavingRoom ? "Leaving…" : "Leave Room"}
                </button>
              </div>
            ) : activeRoom && activeRoom.stale ? (
              <div className="empty-room">
                <p>Your previous room is no longer available.</p>
                <button
                  type="button"
                  className="leave-room-btn leave-room-btn-inline"
                  onClick={handleLeaveActiveRoom}
                  disabled={leavingRoom}
                >
                  {leavingRoom ? "Leaving…" : "Clear"}
                </button>
              </div>
            ) : (
              <div className="empty-room">
                <p>You are not currently in a room.</p>
              </div>
            )}

            {activeRoomError && (
              <p className="active-room-error">{activeRoomError}</p>
            )}

          </div>


          {/* Recently joined rooms */}
          <div className="recent-rooms">

            <div className="section-title">
              <h2>Recently Joined</h2>
              <span className="recent-rooms-count">
                {recentRooms.length}/2
              </span>
            </div>

            {recentRoomsLoading ? (
              <div className="empty-room">
                <p>Loading recent rooms…</p>
              </div>
            ) : recentRooms.length > 0 ? (
              <div className="recent-rooms-list">
                {recentRooms.slice(0, 2).map((room) => (
                  <button
                    key={room.roomId}
                    type="button"
                    className="recent-room-card"
                    onClick={() => handleRejoinRecentRoom(room.roomId)}
                  >
                    <div className="recent-room-top">
                      <span className="recent-room-name">
                        {room.roomName || "Untitled room"}
                      </span>
                      <span className="recent-room-language">
                        {formatLanguage(room.language)}
                      </span>
                    </div>
                    <div className="recent-room-bottom">
                      <span className="recent-room-id" title={room.roomId}>
                        ID: {room.roomId}
                      </span>
                      <span className="recent-room-participants">
                        {room.userCount || 1}/3
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="empty-room">
                <p>No recently joined rooms.</p>
              </div>
            )}

          </div>


          {/* Room actions */}
          <div className="room-actions">

            <button
              className="create-room-btn"
              type="button"
              onClick={openCreateRoomModal}
            >
              + Create Room
            </button>

            <button
              className="join-room-btn"
              type="button"
              onClick={openJoinRoomModal}
            >
              Join Room
            </button>

          </div>

        </aside>

      </main>


      {/* ================= CREATE ROOM MODAL ================= */}
      {roomMode === "create" && createPortal(
        <div
          className="modal-overlay"
          onClick={closeRoomModal}
          role="presentation"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-room-title"
          >
            <div className="modal-header">
              <div>
                <h2
                  id="create-room-title"
                  className="modal-title"
                >
                  Create Room
                </h2>
                <p className="modal-subtitle">
                  Start a collaborative coding session with up to 3 people.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeRoomModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={handleCreateRoom}
              noValidate
            >
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-name"
                >
                  Room Name
                </label>
                <input
                  id="room-name"
                  className="form-input"
                  type="text"
                  placeholder="Enter room name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  autoFocus
                  disabled={roomLoading}
                />
              </div>

              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="room-language"
                >
                  Programming Language
                </label>
                <select
                  id="room-language"
                  className="form-select"
                  value={roomLanguage}
                  onChange={(e) => setRoomLanguage(e.target.value)}
                  disabled={roomLoading}
                >
                  <option value="cpp">C++</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="java">Java</option>
                </select>
              </div>

              <p className="room-info">
                Maximum 3 participants per room.
              </p>

              {roomError && (
                <p className="modal-error" role="alert">
                  {roomError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeRoomModal}
                  disabled={roomLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={roomLoading}
                >
                  {roomLoading ? "Creating..." : "Create Room"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}


      {/* ================= JOIN ROOM MODAL ================= */}
      {roomMode === "join" && createPortal(
        <div
          className="modal-overlay"
          onClick={closeRoomModal}
          role="presentation"
        >
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="join-room-title"
          >
            <div className="modal-header">
              <div>
                <h2
                  id="join-room-title"
                  className="modal-title"
                >
                  Join Room
                </h2>
                <p className="modal-subtitle">
                  Enter the Room ID shared with you by another user.
                </p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={closeRoomModal}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <form
              className="modal-body"
              onSubmit={handleJoinRoom}
              noValidate
            >
              <div className="form-group">
                <label
                  className="form-label"
                  htmlFor="join-room-id"
                >
                  Room ID
                </label>
                <input
                  id="join-room-id"
                  className="form-input"
                  type="text"
                  placeholder="Enter Room ID"
                  value={joinRoomId}
                  onChange={(e) => setJoinRoomId(e.target.value)}
                  autoFocus
                  disabled={roomLoading}
                />
              </div>

              {roomError && (
                <p className="modal-error" role="alert">
                  {roomError}
                </p>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="cancel-button"
                  onClick={closeRoomModal}
                  disabled={roomLoading}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={roomLoading}
                >
                  {roomLoading ? "Joining..." : "Join Room"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

export default Dashboard;