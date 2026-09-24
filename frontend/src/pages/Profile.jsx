import { useState, useContext, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config/api";
import "./Profile.css";
import { AuthContext } from "../context/AuthContext";
import ActivityHeatmap from "../components/ActivityHeatmap";

function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Solved problems detailed list
  const [solvedData, setSolvedData] = useState({
    solvedProblems: [],
  });
  const [loadingSolved, setLoadingSolved] = useState(true);

  // Personal Analytics State
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState("");

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    setAnalyticsError("");
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/analytics`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.analytics) {
          setAnalytics(data.analytics);
        }
      } else {
        setAnalyticsError("Could not load personal analytics");
      }
    } catch {
      setAnalyticsError("Network error loading analytics");
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  const fetchSolvedProblems = useCallback(async () => {
    setLoadingSolved(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/solved-problems`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setSolvedData({
          solvedProblems: Array.isArray(data.solvedProblems) ? data.solvedProblems : [],
        });
      }
    } catch {
      // Handled silently, solved list shows empty state
    } finally {
      setLoadingSolved(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    fetchSolvedProblems();
  }, [fetchAnalytics, fetchSolvedProblems]);

  const handleLogout = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/users/logout`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        setUser(null);
        navigate("/login");
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <div className="profile-header-left">
          <button
            type="button"
            className="profile-back-btn"
            onClick={() => navigate("/dashboard")}
            aria-label="Back to dashboard"
          >
            ← Dashboard
          </button>
          <h1>Developer Profile</h1>
        </div>

        <button
          type="button"
          className="profile-settings-btn"
          onClick={() => navigate("/settings")}
        >
          Settings
        </button>
      </header>

      <main className="profile-content">
        {/* Profile Identity Card */}
        <section className="profile-identity-card">
          <div className="profile-badge-avatar">
            <span>{user?.name ? user.name.slice(0, 2).toUpperCase() : "US"}</span>
          </div>

          <div className="profile-identity-info">
            <h2>{user?.name || "Developer"}</h2>
            <p className="profile-identity-email">{user?.email || "No email available"}</p>
            <div className="profile-identity-meta">
              <span className="profile-meta-label">MEMBER SINCE</span>
              <span className="profile-meta-value">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "Active"}
              </span>
            </div>
          </div>
        </section>

        {/* Analytics Error Notification if fetch failed */}
        {analyticsError && (
          <div className="profile-analytics-error" role="alert">
            <span>{analyticsError}</span>
            <button
              type="button"
              className="profile-retry-btn"
              onClick={fetchAnalytics}
            >
              Retry
            </button>
          </div>
        )}

        {/* 1. Solved Problems Statistics */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Solved Problem Metrics</h2>
            <span className="profile-section-tag">AUTHORITATIVE</span>
          </div>

          <div className="metrics-grid">
            <div className="metric-tile metric-tile-total">
              <span className="metric-tile-label">TOTAL SOLVED</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.solved?.totalSolved ?? 0}
              </div>
            </div>

            <div className="metric-tile metric-tile-easy">
              <span className="metric-tile-label">EASY</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.solved?.easy ?? 0}
              </div>
            </div>

            <div className="metric-tile metric-tile-medium">
              <span className="metric-tile-label">MEDIUM</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.solved?.medium ?? 0}
              </div>
            </div>

            <div className="metric-tile metric-tile-hard">
              <span className="metric-tile-label">HARD</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.solved?.hard ?? 0}
              </div>
            </div>
          </div>
        </section>

        {/* 2. Personal Submission Activity Cadence (Heatmap) */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Submission Activity Cadence</h2>
            <span className="profile-section-tag">LAST 12 WEEKS</span>
          </div>

          <ActivityHeatmap
            activity={analytics?.activity}
            loading={analyticsLoading}
          />
        </section>

        {/* 3. Submission & Evaluation Statistics */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Submission Evaluation Summary</h2>
            <span className="profile-section-tag">PIPELINE</span>
          </div>

          <div className="metrics-grid">
            <div className="metric-tile metric-tile-accent">
              <span className="metric-tile-label">TOTAL SUBMISSIONS</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.submissions?.total ?? 0}
              </div>
            </div>

            <div className="metric-tile metric-tile-accepted">
              <span className="metric-tile-label">ACCEPTED</span>
              <div className="metric-tile-value">
                {analyticsLoading ? "…" : analytics?.submissions?.accepted ?? 0}
              </div>
            </div>

            <div className="metric-tile">
              <span className="metric-tile-label">ACCEPTANCE RATE</span>
              <div className="metric-tile-value">
                {analyticsLoading
                  ? "…"
                  : `${analytics?.submissions?.acceptanceRate ?? 0}%`}
              </div>
            </div>

            <div className="metric-tile">
              <span className="metric-tile-label">CURRENT STREAK</span>
              <div className="metric-tile-value">
                {analyticsLoading
                  ? "…"
                  : `${analytics?.activity?.currentStreak ?? 0}d`}
              </div>
              <span className="metric-tile-sub">
                Best: {analytics?.activity?.longestStreak ?? 0}d
              </span>
            </div>
          </div>

          {/* Compact Status Breakdown & Scope */}
          <div className="submissions-breakdown-table">
            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-accepted" aria-hidden="true" />
                <span>Accepted Submissions</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.accepted ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-wrong" aria-hidden="true" />
                <span>Wrong Answer</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.wrongAnswer ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-tle" aria-hidden="true" />
                <span>Time Limit Exceeded</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.timeLimitExceeded ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-runtime" aria-hidden="true" />
                <span>Runtime Error</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.runtimeError ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-compile" aria-hidden="true" />
                <span>Compilation Error</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.compilationError ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-solo" aria-hidden="true" />
                <span>Solo Submissions</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.soloSubmissions ?? 0}
              </span>
            </div>

            <div className="submissions-breakdown-row">
              <div className="submissions-row-label">
                <span className="status-indicator-dot dot-room" aria-hidden="true" />
                <span>Room Submissions</span>
              </div>
              <span className="submissions-row-count">
                {analyticsLoading ? "…" : analytics?.submissions?.roomSubmissions ?? 0}
              </span>
            </div>
          </div>
        </section>

        {/* 4. Performance Benchmarks */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Execution Performance</h2>
            <span className="profile-section-tag">BENCHMARK</span>
          </div>

          <div className="performance-grid">
            <div className="metric-tile">
              <span className="metric-tile-label">AVERAGE RUNTIME</span>
              <div
                className={`metric-tile-value ${
                  analytics?.performance?.averageRuntimeMs === null
                    ? "metric-tile-unavailable"
                    : ""
                }`}
              >
                {analyticsLoading
                  ? "…"
                  : analytics?.performance?.averageRuntimeMs !== null
                  ? `${analytics.performance.averageRuntimeMs} ms`
                  : "No runtime data yet"}
              </div>
            </div>

            <div className="metric-tile">
              <span className="metric-tile-label">FASTEST ACCEPTED RUNTIME</span>
              <div
                className={`metric-tile-value ${
                  analytics?.performance?.fastestAcceptedRuntimeMs === null
                    ? "metric-tile-unavailable"
                    : ""
                }`}
              >
                {analyticsLoading
                  ? "…"
                  : analytics?.performance?.fastestAcceptedRuntimeMs !== null
                  ? `${analytics.performance.fastestAcceptedRuntimeMs} ms`
                  : "No accepted runtimes yet"}
              </div>
            </div>

            <div className="metric-tile">
              <span className="metric-tile-label">AVERAGE MEMORY</span>
              <div
                className={`metric-tile-value ${
                  analytics?.performance?.averageMemoryKb === null
                    ? "metric-tile-unavailable"
                    : ""
                }`}
              >
                {analyticsLoading
                  ? "…"
                  : analytics?.performance?.averageMemoryKb !== null
                  ? `${analytics.performance.averageMemoryKb} KB`
                  : "No memory data yet"}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Topics Distribution */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Solved Topic Distribution</h2>
          </div>

          {analyticsLoading ? (
            <div className="profile-empty-log">Loading topics…</div>
          ) : Array.isArray(analytics?.topics) && analytics.topics.length > 0 ? (
            <div className="topics-tag-grid">
              {analytics.topics.map((t) => (
                <div key={t.tag} className="topic-tag-chip">
                  <span className="topic-tag-name">{t.tag}</span>
                  <span className="topic-tag-count">{t.solvedCount}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-log">
              No topic distributions recorded yet. Solve problems across different categories to track your algorithm coverage.
            </div>
          )}
        </section>

        {/* 6. Room Activity */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Collaboration Overview</h2>
          </div>

          <div className="collab-metrics-grid">
            <div className="metric-tile">
              <span className="metric-tile-label">ACTIVE ROOM</span>
              <div className="metric-tile-value">
                {user?.activeRoom ? "1" : "0"}
              </div>
            </div>

            <div className="metric-tile">
              <span className="metric-tile-label">RECENT ROOMS</span>
              <div className="metric-tile-value">
                {Array.isArray(user?.recentRooms) ? user.recentRooms.length : 0}
              </div>
            </div>
          </div>
        </section>

        {/* 7. Solved Problems Log */}
        <section className="profile-section">
          <div className="profile-section-header">
            <h2>Recently Solved Challenges</h2>
          </div>

          {loadingSolved ? (
            <div className="profile-empty-log">Loading activity…</div>
          ) : solvedData.solvedProblems.length > 0 ? (
            <div className="profile-solved-table">
              {solvedData.solvedProblems.slice(0, 5).map((prob) => (
                <div
                  key={prob._id}
                  className="profile-solved-row"
                  onClick={() => navigate(`/problems/${prob.slug}`)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") navigate(`/problems/${prob.slug}`);
                  }}
                >
                  <div className="profile-solved-main">
                    <span className="profile-solved-title">{prob.title}</span>
                    <span
                      className={`badge-${prob.difficulty?.toLowerCase() || "easy"}`}
                    >
                      {prob.difficulty}
                    </span>
                  </div>
                  <div className="profile-solved-date">
                    {new Date(prob.solvedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="profile-empty-log">
              No solved problems yet. Solve challenges in Problem Workspace to populate your performance metrics.
            </div>
          )}
        </section>

        {/* Session Management */}
        <section className="profile-section profile-session-section">
          <div className="session-info">
            <h2>Session Management</h2>
            <p>Terminate your current CodeSync AI authentication session.</p>
          </div>

          <button
            type="button"
            className="profile-logout-btn"
            onClick={() => setShowLogoutConfirm(true)}
          >
            Sign Out
          </button>
        </section>
      </main>

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div className="modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Confirm Sign Out</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowLogoutConfirm(false)}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <p style={{ color: "var(--text-secondary)", fontSize: "13px" }}>
                Are you sure you want to sign out of your CodeSync AI session on this device?
              </p>

              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="profile-logout-btn"
                  onClick={handleLogout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Profile;