import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { AuthContext } from "../context/AuthContext";

function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [solvedData, setSolvedData] = useState({
    solvedProblems: [],
    stats: { totalSolved: 0, easy: 0, medium: 0, hard: 0 },
  });
  const [loadingSolved, setLoadingSolved] = useState(true);

  useEffect(() => {
    const fetchSolvedProblems = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/users/solved-problems", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          setSolvedData({
            solvedProblems: Array.isArray(data.solvedProblems) ? data.solvedProblems : [],
            stats: data.stats || { totalSolved: 0, easy: 0, medium: 0, hard: 0 },
          });
        }
      } catch (err) {
        console.error("Failed to load solved problems:", err);
      } finally {
        setLoadingSolved(false);
      }
    };

    fetchSolvedProblems();
  }, []);

  const handleLogout = async () => {
      try {
        const response = await fetch(
          "http://localhost:5000/api/users/logout",
          {
            method: "POST",
            credentials: "include",
          }
        );

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
        <h1>My Profile</h1>

        <button
          type="button"
          onClick={() => navigate("/settings")}
        >
          ⚙ Settings
        </button>
      </header>

      <main className="profile-content">

        {/* Profile information */}
        <section className="profile-info">
          <div className="profile-large-avatar">
            👤
          </div>

          <div>
            <h2>{user?.name || "User"}</h2>
            <p>{user?.email || "No email available"}</p>
            <p>
              Member since:{" "}
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "Not available"}
            </p>
          </div>
        </section>

        {/* Coding statistics */}
        <section className="profile-stats">
          <h2>Coding Statistics</h2>

          <div className="stats-grid">
            <div>
              <h3>{loadingSolved ? "…" : solvedData.stats.totalSolved}</h3>
              <p>Problems Solved</p>
            </div>

            <div>
              <h3>{loadingSolved ? "…" : solvedData.stats.easy}</h3>
              <p>Easy</p>
            </div>

            <div>
              <h3>{loadingSolved ? "…" : solvedData.stats.medium}</h3>
              <p>Medium</p>
            </div>

            <div>
              <h3>{loadingSolved ? "…" : solvedData.stats.hard}</h3>
              <p>Hard</p>
            </div>
          </div>
        </section>

        {/* Room statistics */}
        <section className="room-stats">
          <h2>Room Activity</h2>

          <div className="stats-grid">
            <div>
              <h3>{user?.activeRoom ? 1 : 0}</h3>
              <p>Active Room</p>
            </div>

            <div>
              <h3>{Array.isArray(user?.recentRooms) ? user.recentRooms.length : 0}</h3>
              <p>Recent Rooms</p>
            </div>
          </div>
        </section>

        {/* Recent activity / Solved Problems */}
        <section className="recent-activity">
          <h2>Recent Activity</h2>
          {loadingSolved ? (
            <p>Loading activity…</p>
          ) : solvedData.solvedProblems.length > 0 ? (
            <div className="profile-solved-list">
              {solvedData.solvedProblems.slice(0, 5).map((prob) => (
                <div
                  key={prob._id}
                  className="profile-solved-item"
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
                      className={`difficulty-badge difficulty-${prob.difficulty?.toLowerCase() || "easy"}`}
                    >
                      {prob.difficulty}
                    </span>
                  </div>
                  <div className="profile-solved-date">
                    Solved on {new Date(prob.solvedAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No solved problems yet. Submit solutions in Problem Workspace to track progress.</p>
          )}
        </section>

        <section className="logout-section">
          <div>
            <h2>Logout</h2>
            <p>Sign out of your CodeSync AI account on this device.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowLogoutConfirm(true)}
          >
            Logout
          </button>
        </section>
      </main>


      {/* {*cross check for log out*} */}
      {showLogoutConfirm && (
          <div className="logout-modal-overlay">
            <div className="logout-modal">
              <h2>Log out?</h2>

              <p>
                Are you sure you want to log out of your CodeSync AI account?
              </p>

              <div className="logout-modal-actions">
                <button
                  type="button"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="confirm-logout-btn"
                  onClick={handleLogout}
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}

export default Profile;