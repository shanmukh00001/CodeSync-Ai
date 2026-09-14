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
    } catch {
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
    } catch {
      setPasswordError("Network error. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <header className="settings-header">
        <button
          type="button"
          className="settings-back-btn"
          onClick={() => navigate("/profile")}
        >
          ← Profile
        </button>
        <h1>Account Settings</h1>
      </header>

      <main className="settings-content">
        {/* ACCOUNT SECTION */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2>Account Identity</h2>
          </div>
          <div className="setting-item">
            <div className="setting-details">
              <h3>Display Name</h3>
              <p>Your display name can only be modified once.</p>
              
              <form onSubmit={handleNameChange} className="settings-form">
                {nameError && <p className="form-error-msg">{nameError}</p>}
                {nameSuccess && <p className="form-success-msg">{nameSuccess}</p>}
                <div className="settings-form-row">
                  <input 
                    type="text" 
                    value={newName} 
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={user?.nameChanged || nameLoading}
                    className="setting-input"
                    aria-label="Display Name"
                  />
                  <button 
                    type="submit" 
                    disabled={user?.nameChanged || nameLoading}
                    className="setting-submit-btn"
                  >
                    {user?.nameChanged ? "Locked" : (nameLoading ? "Saving…" : "Update Name")}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>

        {/* SECURITY SECTION */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2>Authentication & Security</h2>
          </div>
          <div className="setting-item">
            <div className="setting-details">
              <h3>Change Password</h3>
              <p>Update your credentials for secure authentication.</p>
              
              <form onSubmit={handlePasswordChange} className="settings-form">
                {passwordError && <p className="form-error-msg">{passwordError}</p>}
                {passwordSuccess && <p className="form-success-msg">{passwordSuccess}</p>}
                
                <div className="settings-form-fields">
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
                    placeholder="New Password (min 8 chars)"
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
                </div>

                <button 
                  type="submit" 
                  disabled={passwordLoading}
                  className="setting-submit-btn"
                >
                  {passwordLoading ? "Updating…" : "Update Password"}
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* PREFERENCES SECTION */}
        <section className="settings-section">
          <div className="settings-section-header">
            <h2>Environment Defaults</h2>
          </div>
          <div className="setting-item setting-item-split">
            <div>
              <h3>Default Language</h3>
              <p>Preferred language syntax for problem starter code.</p>
            </div>
            <select defaultValue="cpp" className="setting-select">
              <option value="cpp">C++ 20</option>
              <option value="python">Python 3</option>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="java">Java 17</option>
            </select>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Settings;