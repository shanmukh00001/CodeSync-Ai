import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./Unauthorized.css";

export default function Unauthorized() {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const attemptedPath = location.state?.from || location.pathname;

  return (
    <div className="unauthorized-container">
      <div className="unauthorized-card">
        <div className="unauthorized-icon-wrap">
          <span>🛡️</span>
        </div>

        <div className="unauthorized-code">Access Denied • 403</div>
        <h1 className="unauthorized-title">Restricted Area</h1>
        <p className="unauthorized-desc">
          You don't have administrator privileges to access this page. This area is reserved for CodeSync AI administrators.
        </p>

        <div className="unauthorized-details-box">
          <div className="unauthorized-detail-row">
            <span className="unauthorized-detail-label">Attempted Route:</span>
            <span className="unauthorized-detail-val">{attemptedPath}</span>
          </div>
          <div className="unauthorized-detail-row">
            <span className="unauthorized-detail-label">Current Account:</span>
            <span className="unauthorized-detail-val">{user?.email || "Not logged in"}</span>
          </div>
          <div className="unauthorized-detail-row">
            <span className="unauthorized-detail-label">Current Role:</span>
            <span className="unauthorized-detail-val">{user?.role || "user"}</span>
          </div>
        </div>

        <div className="unauthorized-actions">
          <Link to="/dashboard" className="unauthorized-btn-primary">
            <span>⚡ Return to Dashboard</span>
          </Link>
          <Link to="/profile" className="unauthorized-btn-secondary">
            <span>👤 View Profile</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
