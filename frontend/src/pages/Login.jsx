import { Link, useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import GoogleAuthButton from "../components/GoogleAuthButton";
import OtpVerificationModal from "../components/OtpVerificationModal";
import "./Login.css";

function Login() {
  const { setUser } = useContext(AuthContext);

  const [authMode, setAuthMode] = useState("password"); // 'password' | 'otp'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const navigate = useNavigate();

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch("http://localhost:5000/api/users/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setUser(data.user);
        navigate("/dashboard");
      } else {
        const message =
          data?.error?.message ||
          data?.message ||
          "Login failed. Please try again.";
        setError(message);
      }
    } catch (error) {
      console.error("Login error:", error);
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:5000/api/users/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose: "login" }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsOtpModalOpen(true);
      } else {
        setError(data?.error?.message || "Failed to send login code.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (data) => {
    setUser(data.user);
    navigate("/dashboard");
  };

  const handleOtpVerified = (data) => {
    setIsOtpModalOpen(false);
    setUser(data.user);
    navigate("/dashboard");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Welcome back</h1>
        <p>Log in to continue to CodeSync AI</p>

        {error && <p className="error-message">{error}</p>}

        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={(err) => setError(err)}
          text="Sign in with Google"
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            textAlign: "center",
            color: "#64748b",
            fontSize: "12px",
            margin: "16px 0",
            gap: "10px",
          }}
        >
          <div style={{ flex: 1, height: "1px", backgroundColor: "#1e293b" }} />
          <span>OR CONTINUE WITH EMAIL</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#1e293b" }} />
        </div>

        {/* Auth Mode Toggle */}
        <div
          style={{
            display: "flex",
            backgroundColor: "#0f172a",
            borderRadius: "8px",
            padding: "4px",
            marginBottom: "16px",
            border: "1px solid #1e293b",
          }}
        >
          <button
            type="button"
            onClick={() => setAuthMode("password")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              backgroundColor: authMode === "password" ? "#1e293b" : "transparent",
              color: authMode === "password" ? "#f8fafc" : "#94a3b8",
              transition: "all 0.2s ease",
            }}
          >
            Password
          </button>
          <button
            type="button"
            onClick={() => setAuthMode("otp")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer",
              backgroundColor: authMode === "otp" ? "#1e293b" : "transparent",
              color: authMode === "otp" ? "#f8fafc" : "#94a3b8",
              transition: "all 0.2s ease",
            }}
          >
            Magic OTP Pass
          </button>
        </div>

        {authMode === "password" ? (
          <form onSubmit={handlePasswordSubmit}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleSendOtp}>
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "-8px", marginBottom: "14px" }}>
              We'll send a 6-digit one-time code to log in password-free.
            </p>

            <button type="submit" disabled={loading}>
              {loading ? "Sending Code..." : "Send Verification Code"}
            </button>
          </form>
        )}

        <p>
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>

      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={email}
        purpose="login"
        onClose={() => setIsOtpModalOpen(false)}
        onVerified={handleOtpVerified}
      />
    </div>
  );
}

export default Login;