import { useState, useEffect } from "react";
import "./LoadingScreen.css";

export default function LoadingScreen({
  title = "CodeSync AI",
  subtitle = "Synchronizing environment...",
  showWarningAfterMs = 3500,
}) {
  const [showColdStart, setShowColdStart] = useState(false);
  const [showReload, setShowReload] = useState(false);

  useEffect(() => {
    const coldStartTimer = setTimeout(() => {
      setShowColdStart(true);
    }, showWarningAfterMs);

    const reloadTimer = setTimeout(() => {
      setShowReload(true);
    }, 12000);

    return () => {
      clearTimeout(coldStartTimer);
      clearTimeout(reloadTimer);
    };
  }, [showWarningAfterMs]);

  return (
    <div className="codesync-loader-overlay" role="status" aria-live="polite">
      <div className="codesync-loader-container">
        {/* Emblem with animated dual-rotating rings */}
        <div className="codesync-loader-emblem">
          <div className="codesync-loader-orbit" />
          <div className="codesync-loader-orbit-inner" />
          <div className="codesync-loader-badge">
            <span>CS</span>
          </div>
        </div>

        {/* Title & dynamic subtitle */}
        <h2 className="codesync-loader-title">{title}</h2>
        <p className="codesync-loader-subtitle">{subtitle}</p>

        {/* High-tech pulsing progress bar */}
        <div className="codesync-loader-bar-wrap">
          <div className="codesync-loader-bar-fill" />
        </div>

        {/* Cold-start notification when backend is waking up */}
        {showColdStart && (
          <div className="codesync-loader-coldstart">
            <span className="codesync-loader-coldstart-icon">⚡</span>
            <span>
              Waking up cloud services (Render cold-start may take ~20s)...
            </span>
          </div>
        )}

        {/* Reload button for recovery if network drops */}
        {showReload && (
          <button
            type="button"
            className="codesync-loader-refresh-btn"
            onClick={() => window.location.reload()}
          >
            ↻ Force Refresh
          </button>
        )}
      </div>
    </div>
  );
}
