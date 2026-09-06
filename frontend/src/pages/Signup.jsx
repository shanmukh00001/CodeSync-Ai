import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import "./Signup.css";

function Signup() {
  //state variables
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
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
          "http://localhost:5000/api/users/register",
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
          navigate("/login");
        } else {
          // Extract specific validation message from Zod fieldErrors if available
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
        console.log(data);
      } catch (error) {
        console.error("Signup error:", error);
        setError("Network error. Please try again.");
      }
      finally {
        setLoading(false);
      }
    };
  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create an account</h1>
        <p>Join CodeSync AI and start coding together.</p>
        {error && <p className="error-message">{error}</p>}
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
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

export default Signup;