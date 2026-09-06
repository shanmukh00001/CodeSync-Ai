import { useState, useEffect, useCallback } from "react";
import "./SubmissionsView.css";

const LANGUAGE_LABELS = {
  cpp: "C++",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
};

const formatLanguage = (code) =>
  LANGUAGE_LABELS[code] || (code ? code.toUpperCase() : "—");

function SubmissionsView({ problemId, currentLanguage, refreshTrigger }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const fetchSubmissions = useCallback(async () => {
    if (!problemId) {
      setSubmissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/submissions/problem/${problemId}/history`,
        { credentials: "include" }
      );

      if (!response.ok) {
        throw new Error("Failed to load submission history");
      }

      const data = await response.json();
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [problemId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions, refreshTrigger]);

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "Accepted":
        return "status-accepted";
      case "Wrong Answer":
        return "status-wrong";
      case "Time Limit Exceeded":
      case "Runtime Error":
      case "Compilation Error":
        return "status-error";
      case "Pending":
      default:
        return "status-pending";
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return "";
    try {
      const date = new Date(dateStr);
      return date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="submissions-view-container">
      <div className="submissions-view-header">
        <div className="submissions-header-left">
          <span className="submissions-title-icon" aria-hidden="true">
            📋
          </span>
          <h2 className="submissions-view-title">Submission History</h2>
        </div>
        <button
          type="button"
          className="submissions-refresh-btn"
          onClick={fetchSubmissions}
          disabled={loading}
          aria-label="Refresh submissions"
        >
          {loading ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      <div className="submissions-view-body">
        {loading ? (
          <div className="submissions-state-box">
            <div className="submissions-spinner" />
            <p>Loading submission history…</p>
          </div>
        ) : error ? (
          <div className="submissions-state-box submissions-error-box">
            <p>{error}</p>
            <button
              type="button"
              className="submissions-retry-btn"
              onClick={fetchSubmissions}
            >
              Try Again
            </button>
          </div>
        ) : submissions.length === 0 ? (
          <div className="submissions-empty-state">
            <div className="submissions-empty-icon" aria-hidden="true">
              📥
            </div>
            <h3 className="submissions-empty-heading">No submissions yet</h3>
            <p className="submissions-empty-text">
              Your submitted solutions will appear here with execution status,
              test case details, and timestamps.
            </p>
            <div className="submissions-empty-tip">
              <span>Tip:</span> Write your solution in{" "}
              <strong>{formatLanguage(currentLanguage)}</strong> and click the{" "}
              <strong>Submit</strong> button above the code editor to submit.
            </div>
          </div>
        ) : (
          <div className="submissions-list">
            {submissions.map((sub) => {
              const isSelected = selectedSubmission?._id === sub._id;
              const hasVisibleFailedCase =
                sub.failedTestCase &&
                sub.failedTestCase.isHidden !== true &&
                sub.failedTestCase.input !== null &&
                sub.failedTestCase.input !== undefined;
              const isHiddenFailedCase =
                sub.failedTestCase?.isHidden === true;

              return (
                <div
                  key={sub._id}
                  className={`submission-card ${
                    isSelected ? "is-selected" : ""
                  }`}
                  onClick={() =>
                    setSelectedSubmission(isSelected ? null : sub)
                  }
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedSubmission(isSelected ? null : sub);
                    }
                  }}
                  aria-expanded={isSelected}
                >
                  <div className="submission-card-header">
                    <span
                      className={`submission-status-badge ${getStatusBadgeClass(
                        sub.status
                      )}`}
                    >
                      {sub.status === "Accepted"
                        ? "✓ Accepted"
                        : sub.status === "Wrong Answer"
                        ? "✗ Wrong Answer"
                        : sub.status}
                    </span>
                    <span className="submission-time">
                      {formatTimestamp(sub.createdAt)}
                    </span>
                  </div>

                  <div className="submission-card-meta">
                    <div className="submission-meta-item">
                      <span className="submission-meta-label">Passed:</span>
                      <span className="submission-meta-val">
                        {sub.passedTestCases || 0} / {sub.totalTestCases || 0}{" "}
                        test cases
                      </span>
                    </div>

                    <div className="submission-meta-item">
                      <span className="submission-meta-label">Language:</span>
                      <span className="submission-language-chip">
                        {formatLanguage(sub.language)}
                      </span>
                    </div>

                    {typeof sub.runtimeMs === "number" && sub.runtimeMs > 0 && (
                      <div className="submission-meta-item">
                        <span className="submission-meta-label">Runtime:</span>
                        <span className="submission-meta-val">
                          {sub.runtimeMs} ms
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Expandable details section */}
                  {isSelected && (
                    <div className="submission-details-drawer">
                      {hasVisibleFailedCase && (
                        <div className="submission-failed-case">
                          <div className="submission-failed-title">
                            Failed Test Case
                            {typeof sub.failedTestCase.testCaseIndex === "number"
                              ? ` #${sub.failedTestCase.testCaseIndex + 1}`
                              : ""}:
                          </div>
                          <div className="submission-case-row">
                            <span>Input:</span>
                            <code>
                              {typeof sub.failedTestCase.input === "object"
                                ? JSON.stringify(sub.failedTestCase.input)
                                : String(sub.failedTestCase.input)}
                            </code>
                          </div>
                          <div className="submission-case-row">
                            <span>Expected:</span>
                            <code>
                              {typeof sub.failedTestCase.expected === "object"
                                ? JSON.stringify(sub.failedTestCase.expected)
                                : String(sub.failedTestCase.expected)}
                            </code>
                          </div>
                          <div className="submission-case-row">
                            <span>Your output:</span>
                            <code>
                              {typeof sub.failedTestCase.actual === "object"
                                ? JSON.stringify(sub.failedTestCase.actual)
                                : String(sub.failedTestCase.actual)}
                            </code>
                          </div>
                        </div>
                      )}

                      {isHiddenFailedCase && (
                        <div className="submission-failed-case">
                          <div className="submission-failed-title">
                            Failed Test Case:
                          </div>
                          <div className="submission-case-row">
                            <span>Note:</span>
                            <code>Hidden test failed</code>
                          </div>
                        </div>
                      )}

                      {sub.code && (
                        <div className="submission-code-preview">
                          <div className="submission-code-header">
                            Submitted Code:
                          </div>
                          <pre className="submission-code-block">
                            {sub.code}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SubmissionsView;
