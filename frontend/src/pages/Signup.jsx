import { Link, useNavigate } from "react-router-dom";
import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import GoogleAuthButton from "../components/GoogleAuthButton";
import OtpVerificationModal from "../components/OtpVerificationModal";
import { API_BASE_URL } from "../config/api";
import "./Signup.css";

function Signup() {
  const { setUser } = useContext(AuthContext);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOtpModalOpen, setIsOtpModalOpen] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setLoading(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/users/register`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        // Open OTP modal for registration verification
        setIsOtpModalOpen(true);
      } else {
        let message = "";
        if (data?.error?.details?.fieldErrors) {
          const firstField = Object.keys(data.error.details.fieldErrors)[0];
          if (firstField && data.error.details.fieldErrors[firstField]?.length > 0) {
            message = data.error.details.fieldErrors[firstField][0];
          }
        }
        if (!message) {
          message =
            data?.error?.message ||
            data?.message ||
            "Signup failed. Please try again.";
        }
        setError(message);
      }
    } catch (error) {
      console.error("Signup error:", error);
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
        <h1>Create an account</h1>
        <p>Join CodeSync AI and start coding together.</p>

        {error && <p className="error-message">{error}</p>}

        <GoogleAuthButton
          onSuccess={handleGoogleSuccess}
          onError={(err) => setError(err)}
          text="Sign up with Google"
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
          <span>OR SIGN UP WITH EMAIL</span>
          <div style={{ flex: 1, height: "1px", backgroundColor: "#1e293b" }} />
        </div>

        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

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
            placeholder="Create a password (min. 8 characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />

          <label>Confirm Password</label>
          <input
            type="password"
            placeholder="Confirm your password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={8}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>

      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={email}
        purpose="verification"
        onClose={() => setIsOtpModalOpen(false)}
        onVerified={handleOtpVerified}
      />
    </div>
  );
}

export default Signup;