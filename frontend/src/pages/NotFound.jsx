import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./NotFound.css";

export default function NotFound() {
  const location = useLocation();

  return (
    <div className="not-found-container">
      <div className="not-found-card">
        <div className="not-found-icon-wrap">
          <span>🔍</span>
        </div>
        
        <div className="not-found-code">Error 404</div>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The link you tried to access does not exist or may have been moved.
        </p>

        <div className="not-found-path-box">
          <span className="not-found-path-label">Requested URL:</span>
          <span className="not-found-path-val">{location.pathname}</span>
        </div>

        <div className="not-found-actions">
          <Link to="/dashboard" className="not-found-btn-primary">
            <span>⚡ Go to Dashboard</span>
          </Link>
          <Link to="/" className="not-found-btn-secondary">
            <span>🏠 Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
