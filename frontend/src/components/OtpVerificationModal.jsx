import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "../config/api";

export default function OtpVerificationModal({
  email,
  purpose = "verification",
  isOpen,
  onClose,
  onVerified,
}) {
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [resendLoading, setResendLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setOtp(["", "", "", "", "", ""]);
      setError("");
      setInfoMessage("");
      return;
    }
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (index, value) => {
    if (value.length > 1) {
      // Handle paste of 6 digits
      const pasted = value.replace(/\D/g, "").slice(0, 6).split("");
      const newOtp = [...otp];
      pasted.forEach((char, i) => {
        newOtp[i] = char;
      });
      setOtp(newOtp);
      const nextInput = document.getElementById(`otp-input-${Math.min(pasted.length, 5)}`);
      if (nextInput) nextInput.focus();
      return;
    }

    if (/^[0-9]?$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-input-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-input-${index - 1}`);
      if (prevInput) {
        prevInput.focus();
      }
    }
  };

  const handleVerify = async (e) => {
    if (e) e.preventDefault();
    const code = otp.join("");
    if (code.length < 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }

    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          otp: code,
          purpose,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (onVerified) onVerified(data);
      } else {
        setError(data?.error?.message || data?.message || "Invalid verification code.");
      }
    } catch (err) {
      console.error("OTP verification error:", err);
      setError("Network error while verifying OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || resendLoading) return;

    setResendLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/users/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, purpose }),
      });

      const data = await response.json();

      if (response.ok) {
        setInfoMessage("A fresh 6-digit code was sent to your email!");
        setResendTimer(60);
      } else {
        setError(data?.error?.message || "Failed to resend code.");
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#111827",
          border: "1px solid #1f293d",
          borderRadius: "16px",
          maxWidth: "440px",
          width: "100%",
          padding: "32px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
          textAlign: "center",
          position: "relative",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            color: "#94a3b8",
            fontSize: "20px",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          ✕
        </button>

        <div style={{ fontSize: "36px", marginBottom: "12px" }}>📩</div>
        <h2 style={{ fontSize: "20px", fontWeight: "700", color: "#f8fafc", margin: "0 0 8px" }}>
          Verify Your Email
        </h2>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 24px" }}>
          Enter the 6-digit verification code sent to <br />
          <strong style={{ color: "#fb923c" }}>{email}</strong>
        </p>

        {error && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "rgba(239, 68, 68, 0.12)",
              border: "1px solid rgba(239, 68, 68, 0.3)",
              borderRadius: "8px",
              color: "#f87171",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {infoMessage && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "rgba(34, 197, 94, 0.12)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              borderRadius: "8px",
              color: "#4ade80",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {infoMessage}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px", justifyContent: "center", marginBottom: "24px" }}>
          {otp.map((digit, idx) => (
            <input
              key={idx}
              id={`otp-input-${idx}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(idx, e.target.value)}
              onKeyDown={(e) => handleKeyDown(idx, e)}
              style={{
                width: "44px",
                height: "52px",
                fontSize: "22px",
                fontWeight: "700",
                textAlign: "center",
                backgroundColor: "#0f172a",
                border: digit ? "1.5px solid #f97316" : "1px solid #334155",
                borderRadius: "8px",
                color: "#f8fafc",
                outline: "none",
                transition: "all 0.2s ease",
              }}
              autoFocus={idx === 0}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={handleVerify}
          disabled={loading || otp.join("").length < 6}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: "#f97316",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            fontSize: "15px",
            fontWeight: "600",
            cursor: loading || otp.join("").length < 6 ? "not-allowed" : "pointer",
            opacity: loading || otp.join("").length < 6 ? 0.6 : 1,
            transition: "background-color 0.2s ease",
            marginBottom: "16px",
          }}
        >
          {loading ? "Verifying..." : "Verify & Continue"}
        </button>

        <div style={{ fontSize: "13px", color: "#64748b" }}>
          Didn't receive the code?{" "}
          {resendTimer > 0 ? (
            <span style={{ color: "#94a3b8" }}>Resend in {resendTimer}s</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resendLoading}
              style={{
                background: "none",
                border: "none",
                color: "#f97316",
                fontWeight: "600",
                cursor: "pointer",
                padding: 0,
                textDecoration: "underline",
              }}
            >
              {resendLoading ? "Sending..." : "Resend Code"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
