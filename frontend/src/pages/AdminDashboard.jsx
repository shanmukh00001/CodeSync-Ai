import React, { useState, useEffect, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "./AdminDashboard.css";

export default function AdminDashboard() {
  const { user, isAdmin, loading: authLoading } = useContext(AuthContext);
  const [problems, setProblems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteModalId, setDeleteModalId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/unauthorized", { state: { from: "/admin" } });
    }
  }, [isAdmin, authLoading, navigate]);

  const fetchProblems = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:5000/api/admin/problems", {
        credentials: "include",
      });
      const data = await response.json();
      if (response.ok) {
        setProblems(data.problems || []);
      } else {
        setError(data?.error?.message || "Failed to load admin problems.");
      }
    } catch (err) {
      console.error("Error fetching admin problems:", err);
      setError("Network error loading problems.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchProblems();
    }
  }, [isAdmin]);

  const handleDelete = async () => {
    if (!deleteModalId) return;
    setDeleting(true);
    try {
      const response = await fetch(`http://localhost:5000/api/admin/problems/${deleteModalId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.ok) {
        setProblems((prev) => prev.filter((p) => p._id !== deleteModalId));
        setDeleteModalId(null);
      } else {
        const data = await response.json();
        alert(data?.error?.message || "Failed to delete problem.");
      }
    } catch (err) {
      alert("Network error deleting problem.");
    } finally {
      setDeleting(false);
    }
  };

  const filteredProblems = problems.filter((p) =>
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.slug?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalTestCases = problems.reduce((acc, p) => acc + (p.testCases?.length || 0), 0);
  const hiddenTestCases = problems.reduce(
    (acc, p) => acc + (p.testCases?.filter((tc) => tc.isHidden)?.length || 0),
    0
  );

  return (
    <div className="admin-dashboard-container">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-brand">
          <Link to="/dashboard" className="back-link">
            ← Back to Platform
          </Link>
          <div className="admin-title-row">
            <h1>🛡️ Admin Command Center</h1>
            <span className="admin-badge">Admin Access</span>
          </div>
          <p className="admin-subtitle">
            Manage algorithmic challenges, testcase suites, and sandbox validator definitions.
          </p>
        </div>

        <div className="admin-header-actions">
          <Link to="/admin/problems/new" className="create-problem-btn">
            + Create New Problem
          </Link>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="admin-metrics-grid">
        <div className="metric-card">
          <span className="metric-icon">📚</span>
          <div className="metric-info">
            <span className="metric-label">Total Problems</span>
            <span className="metric-value">{problems.length}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">🧪</span>
          <div className="metric-info">
            <span className="metric-label">Total Test Cases</span>
            <span className="metric-value">{totalTestCases}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">🔒</span>
          <div className="metric-info">
            <span className="metric-label">Hidden Test Suites</span>
            <span className="metric-value">{hiddenTestCases}</span>
          </div>
        </div>

        <div className="metric-card">
          <span className="metric-icon">⚡</span>
          <div className="metric-info">
            <span className="metric-label">Platform Role</span>
            <span className="metric-value" style={{ textTransform: "capitalize" }}>
              {user?.role || "Admin"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Problems Table Card */}
      <div className="admin-table-card">
        <div className="table-controls">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by title, slug, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className="clear-search-btn" onClick={() => setSearchTerm("")}>
                ✕
              </button>
            )}
          </div>
          <button className="refresh-btn" onClick={fetchProblems} disabled={loading}>
            🔄 Refresh
          </button>
        </div>

        {error && <div className="admin-error-banner">{error}</div>}

        {loading ? (
          <div className="admin-loading-state">
            <div className="admin-spinner" />
            <p>Loading problem repository...</p>
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="admin-empty-state">
            <span style={{ fontSize: "40px" }}>📝</span>
            <h3>No problems found</h3>
            <p>No questions matched your search criteria or the database is currently empty.</p>
            <Link to="/admin/problems/new" className="create-problem-btn" style={{ marginTop: "12px" }}>
              + Add First Problem
            </Link>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Title & Slug</th>
                  <th>Difficulty</th>
                  <th>Tags</th>
                  <th>Test Cases</th>
                  <th>Function Spec</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProblems.map((prob) => (
                  <tr key={prob._id}>
                    <td>
                      <div className="prob-title-cell">
                        <Link to={`/problem/${prob.slug}`} className="prob-name-link" target="_blank">
                          {prob.title}
                        </Link>
                        <span className="prob-slug">/{prob.slug}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`diff-tag diff-${prob.difficulty?.toLowerCase()}`}>
                        {prob.difficulty}
                      </span>
                    </td>
                    <td>
                      <div className="tags-cell">
                        {prob.tags && prob.tags.length > 0 ? (
                          prob.tags.slice(0, 3).map((t, idx) => (
                            <span key={idx} className="tag-pill">
                              {t}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted">None</span>
                        )}
                        {prob.tags?.length > 3 && (
                          <span className="tag-pill more-pill">+{prob.tags.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="testcase-count-pill">
                        {prob.testCases?.length || 0} cases
                        {prob.testCases?.filter((tc) => tc.isHidden)?.length > 0 && (
                          <span className="hidden-badge" title="Hidden test cases present">
                            🔒 {prob.testCases.filter((tc) => tc.isHidden).length} hidden
                          </span>
                        )}
                      </span>
                    </td>
                    <td>
                      <code className="function-badge">
                        {prob.execution?.functionName || "solution"}(...)
                      </code>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="action-buttons-cell">
                        <Link to={`/admin/problems/${prob._id}/edit`} className="action-btn edit-btn">
                          ✏️ Edit
                        </Link>
                        <button
                          className="action-btn delete-btn"
                          onClick={() => setDeleteModalId(prob._id)}
                        >
                          🗑️ Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteModalId && (
        <div className="modal-overlay">
          <div className="confirm-modal">
            <div className="modal-icon">⚠️</div>
            <h3>Delete Coding Problem?</h3>
            <p>
              Are you sure you want to permanently delete this challenge? This action cannot be
              undone.
            </p>
            <div className="modal-actions">
              <button
                className="modal-cancel-btn"
                onClick={() => setDeleteModalId(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button className="modal-confirm-delete-btn" onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting..." : "Yes, Delete Problem"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
