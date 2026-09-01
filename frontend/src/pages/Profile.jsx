import { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import "./Profile.css";
import { AuthContext } from "../context/AuthContext";
//import { useState } from "react";

function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
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
              <h3>0</h3>
              <p>Problems Solved</p>
            </div>

            <div>
              <h3>0</h3>
              <p>Easy</p>
            </div>

            <div>
              <h3>0</h3>
              <p>Medium</p>
            </div>

            <div>
              <h3>0</h3>
              <p>Hard</p>
            </div>
          </div>
        </section>

        {/* Room statistics */}
        <section className="room-stats">
          <h2>Room Activity</h2>

          <div className="stats-grid">
            <div>
              <h3>0</h3>
              <p>Rooms Created</p>
            </div>

            <div>
              <h3>0</h3>
              <p>Rooms Joined</p>
            </div>
          </div>
        </section>

        {/* Recent activity */}
        <section className="recent-activity">
          <h2>Recent Activity</h2>
          <p>No recent activity yet.</p>
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