import { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./Settings.css";

function Settings() {
  const navigate = useNavigate();
  const { user, setUser } = useContext(AuthContext);

  // Name Change State
  const [newName, setNewName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameSuccess, setNameSuccess] = useState("");

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  useEffect(() => {
    if (user && user.name) {
      setNewName(user.name);
    }
  }, [user]);

  const handleNameChange = async (e) => {
    e.preventDefault();
    setNameError("");
    setNameSuccess("");
    
    if (newName.trim() === "") {
        return setNameError("Name cannot be empty");
    }

    setNameLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/users/name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newName }),
      });
      const data = await response.json();

      if (response.ok) {
        setNameSuccess("Name updated successfully!");
        setUser(data.user);
      } else {
        const message =
          data?.error?.message ||
          data?.message ||
          "Failed to update name";
        setNameError(message);
      }
    } catch (err) {
      setNameError("Network error. Please try again.");
    } finally {
      setNameLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      return setPasswordError("New passwords do not match");
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/users/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
        setPasswordSuccess("Password updated successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const message =
          data?.error?.message ||
          data?.message ||
          "Failed to update password";
        setPasswordError(message);
      }
    } catch (err) {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button type="button" onClick={() => navigate("/profile")}>
          ← Back to Profile
        </button>
        <h1>Settings</h1>
      </header>

      <main className="settings-content">
        {/* ACCOUNT SECTION */}
        <section className="settings-section">
          <h2>Account</h2>
          <div className="setting-item">
            <div style={{ width: "100%" }}>
              <h3>Change Name</h3>
              <p>Your name can only be changed once.</p>
              
              <form onSubmit={handleNameChange} className="settings-form">
                {nameError && <p className="form-error-msg">{nameError}</p>}
                {nameSuccess && <p className="form-success-msg">{nameSuccess}</p>}
                <input 
                  type="text" 
                  value={newName} 
                  onChange={(e) => setNewName(e.target.value)}
                  disabled={user?.nameChanged || nameLoading}
                  className="setting-input"
                />
                <button 
                  type="submit" 
                  disabled={user?.nameChanged || nameLoading}
                  className="setting-submit-btn"
                >
                  {user?.nameChanged ? "Already Changed" : (nameLoading ? "Saving..." : "Change Name")}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* SECURITY SECTION */}
        <section className="settings-section">
          <h2>Security</h2>
          <div className="setting-item">
            <div style={{ width: "100%" }}>
              <h3>Change Password</h3>
              <p>Update your account password securely.</p>
              
              <form onSubmit={handlePasswordChange} className="settings-form">
                {passwordError && <p className="form-error-msg">{passwordError}</p>}
                {passwordSuccess && <p className="form-success-msg">{passwordSuccess}</p>}
                
                <input 
                  type="password" 
                  placeholder="Current Password"
                  value={currentPassword} 
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  disabled={passwordLoading}
                  className="setting-input"
                  required
                />
                <input 
                  type="password" 
                  placeholder="New Password"
                  value={newPassword} 
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordLoading}
                  className="setting-input"
                  required
                />
                <input 
                  type="password" 
                  placeholder="Confirm New Password"
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordLoading}
                  className="setting-input"
                  required
                />

                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="setting-submit-btn"
                >
                  {passwordLoading ? "Saving..." : "Change Password"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* CODING PREFERENCES - FOR LATER */}
        <section className="settings-section">
          <h2>Coding Preferences</h2>
          <div className="setting-item">
            <div>
              <h3>Preferred Language</h3>
              <p>Choose your preferred programming language.</p>
            </div>
            <select defaultValue="">
              <option value="" disabled>Select language</option>
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
            </select>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Settings;