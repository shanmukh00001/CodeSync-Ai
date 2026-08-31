import { useNavigate } from "react-router-dom";
import "./Settings.css";

function Settings() {
  const navigate = useNavigate();

  return (
    <div className="settings-page">

      <header className="settings-header">
        <button
          type="button"
          onClick={() => navigate("/profile")}
        >
          ← Back to Profile
        </button>

        <h1>Settings</h1>
      </header>

      <main className="settings-content">

        {/* ACCOUNT SECTION */}
        <section className="settings-section">
          <h2>Account</h2>

          <div className="setting-item">
            <div>
              <h3>Change Name</h3>
              <p>
                Your name can only be changed once.
              </p>
            </div>

            <button type="button">
              Change Name
            </button>
          </div>
        </section>


        {/* SECURITY SECTION */}
        <section className="settings-section">
          <h2>Security</h2>

          <div className="setting-item">
            <div>
              <h3>Change Password</h3>
              <p>
                Update your account password securely.
              </p>
            </div>

            <button type="button">
              Change Password
            </button>
          </div>
        </section>


        {/* CODING PREFERENCES - FOR LATER */}
        <section className="settings-section">
          <h2>Coding Preferences</h2>

          <div className="setting-item">
            <div>
              <h3>Preferred Language</h3>
              <p>
                Choose your preferred programming language.
              </p>
            </div>

            <select defaultValue="">
              <option value="" disabled>
                Select language
              </option>

              <option value="javascript">
                JavaScript
              </option>

              <option value="python">
                Python
              </option>

              <option value="java">
                Java
              </option>

              <option value="cpp">
                C++
              </option>
            </select>
          </div>
        </section>

      </main>

    </div>
  );
}

export default Settings;