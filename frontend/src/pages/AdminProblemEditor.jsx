import React, { useState, useEffect, useContext } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import { AuthContext } from "../context/AuthContext";
import "./AdminProblemEditor.css";

const DEFAULT_STARTER_CODES = {
  javascript: `function solution(nums, target) {
    // Write your code here
}`,
  python: `def solution(nums, target):
    # Write your code here
    pass`,
  java: `class Solution {
    public int[] solution(int[] nums, int target) {
        // Write your code here
        return new int[]{};
    }
}`,
  cpp: `#include <vector>
using namespace std;

class Solution {
public:
    vector<int> solution(vector<int>& nums, int target) {
        // Write your code here
        return {};
    }
};`,
};

export default function AdminProblemEditor() {
  const { id } = useParams();
  const isEditMode = Boolean(id);
  const { isAdmin, loading: authLoading } = useContext(AuthContext);
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    difficulty: "Medium",
    description: "### Problem Statement\n\nGiven an array of integers `nums` and an integer `target`, return indices of the two numbers such that they add up to `target`.\n\n### Constraints\n- 2 <= nums.length <= 10^4\n- -10^9 <= nums[i] <= 10^9",
    tags: "Array, Hash Table",
    constraints: "2 <= nums.length <= 10^4\n-10^9 <= nums[i] <= 10^9",
    functionName: "solution",
    parameters: "nums, target",
    outputComparator: "exact",
    starterCode: DEFAULT_STARTER_CODES,
    examples: [
      {
        input: "nums = [2,7,11,15], target = 9",
        output: "[0,1]",
        explanation: "Because nums[0] + nums[1] == 9, we return [0, 1].",
      },
    ],
    testCases: [
      {
        input: "[2, 7, 11, 15], 9",
        expectedOutput: "[0, 1]",
        isHidden: false,
      },
      {
        input: "[3, 2, 4], 6",
        expectedOutput: "[1, 2]",
        isHidden: false,
      },
      {
        input: "[3, 3], 6",
        expectedOutput: "[0, 1]",
        isHidden: true,
      },
    ],
  });

  const [activeCodeTab, setActiveCodeTab] = useState("javascript");
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      navigate("/unauthorized", { state: { from: window.location.pathname } });
    }
  }, [isAdmin, authLoading, navigate]);

  useEffect(() => {
    if (isEditMode && isAdmin) {
      const fetchProblemDetails = async () => {
        setLoading(true);
        try {
          const res = await fetch(`http://localhost:5000/api/admin/problems/${id}`, {
            credentials: "include",
          });
          const data = await res.json();
          if (res.ok && data.problem) {
            const p = data.problem;
            setFormData({
              title: p.title || "",
              slug: p.slug || "",
              difficulty: p.difficulty || "Medium",
              description: p.description || "",
              tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
              constraints: Array.isArray(p.constraints) ? p.constraints.join("\n") : "",
              functionName: p.execution?.functionName || "solution",
              parameters: Array.isArray(p.execution?.parameters)
                ? p.execution.parameters.join(", ")
                : "nums",
              outputComparator: p.outputComparator || "exact",
              starterCode: {
                javascript: p.starterCode?.javascript || DEFAULT_STARTER_CODES.javascript,
                python: p.starterCode?.python || DEFAULT_STARTER_CODES.python,
                java: p.starterCode?.java || DEFAULT_STARTER_CODES.java,
                cpp: p.starterCode?.cpp || DEFAULT_STARTER_CODES.cpp,
              },
              examples: p.examples?.length ? p.examples : [{ input: "", output: "", explanation: "" }],
              testCases: p.testCases?.length
                ? p.testCases.map((tc) => ({
                    input: typeof tc.input === "object" ? JSON.stringify(tc.input) : String(tc.input),
                    expectedOutput:
                      typeof tc.expectedOutput === "object"
                        ? JSON.stringify(tc.expectedOutput)
                        : String(tc.expectedOutput),
                    isHidden: !!tc.isHidden,
                  }))
                : [{ input: "", expectedOutput: "", isHidden: false }],
            });
          } else {
            setError(data?.error?.message || "Failed to load problem data.");
          }
        } catch (err) {
          setError("Network error fetching problem.");
        } finally {
          setLoading(false);
        }
      };
      fetchProblemDetails();
    }
  }, [id, isEditMode, isAdmin]);

  const handleTitleChange = (val) => {
    setFormData((prev) => ({
      ...prev,
      title: val,
      slug: isEditMode
        ? prev.slug
        : val
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, ""),
    }));
  };

  const handleAddExample = () => {
    setFormData((prev) => ({
      ...prev,
      examples: [...prev.examples, { input: "", output: "", explanation: "" }],
    }));
  };

  const handleRemoveExample = (index) => {
    setFormData((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
    }));
  };

  const handleExampleChange = (index, field, value) => {
    const updated = [...formData.examples];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, examples: updated }));
  };

  const handleAddTestCase = () => {
    setFormData((prev) => ({
      ...prev,
      testCases: [...prev.testCases, { input: "", expectedOutput: "", isHidden: false }],
    }));
  };

  const handleRemoveTestCase = (index) => {
    setFormData((prev) => ({
      ...prev,
      testCases: prev.testCases.filter((_, i) => i !== index),
    }));
  };

  const handleTestCaseChange = (index, field, value) => {
    const updated = [...formData.testCases];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, testCases: updated }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSaving(true);

    try {
      // Parse testcases input / expectedOutput
      const parsedTestCases = formData.testCases.map((tc) => {
        let parsedIn = tc.input;
        let parsedOut = tc.expectedOutput;
        try {
          parsedIn = JSON.parse(tc.input);
        } catch (err) {
          // keep as string
        }
        try {
          parsedOut = JSON.parse(tc.expectedOutput);
        } catch (err) {
          // keep as string
        }
        return {
          input: parsedIn,
          expectedOutput: parsedOut,
          isHidden: !!tc.isHidden,
        };
      });

      const payload = {
        title: formData.title.trim(),
        slug: formData.slug.trim().toLowerCase(),
        difficulty: formData.difficulty,
        description: formData.description,
        tags: formData.tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        constraints: formData.constraints
          .split("\n")
          .map((c) => c.trim())
          .filter(Boolean),
        execution: {
          functionName: formData.functionName.trim(),
          parameters: formData.parameters
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean),
        },
        outputComparator: formData.outputComparator,
        starterCode: formData.starterCode,
        examples: formData.examples.filter((ex) => ex.input && ex.output),
        testCases: parsedTestCases,
      };

      const url = isEditMode
        ? `http://localhost:5000/api/admin/problems/${id}`
        : "http://localhost:5000/api/admin/problems";

      const method = isEditMode ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage(isEditMode ? "Problem updated successfully!" : "Problem created successfully!");
        setTimeout(() => {
          navigate("/admin");
        }, 1200);
      } else {
        setError(data?.error?.message || "Failed to save problem.");
      }
    } catch (err) {
      console.error("Save problem error:", err);
      setError("Network error while saving problem.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-editor-loading">
        <div className="admin-spinner" />
        <p>Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="admin-editor-container">
      {/* Top Header */}
      <header className="editor-top-bar">
        <div className="editor-nav">
          <Link to="/admin" className="back-link">
            ← Admin Dashboard
          </Link>
          <h2>{isEditMode ? `Edit Problem: ${formData.title}` : "Create New Coding Problem"}</h2>
        </div>
        <div className="editor-actions">
          <Link to="/admin" className="cancel-btn">
            Cancel
          </Link>
          <button type="button" className="save-btn" onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving Challenge..." : isEditMode ? "💾 Update Problem" : "🚀 Publish Problem"}
          </button>
        </div>
      </header>

      {error && <div className="admin-error-banner">{error}</div>}
      {successMessage && <div className="admin-success-banner">{successMessage}</div>}

      <div className="editor-layout">
        {/* Left Column: Form & Meta */}
        <div className="editor-main-form">
          <div className="form-card">
            <h3>📌 General Details</h3>
            <div className="form-row">
              <div className="form-group flex-2">
                <label>Problem Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Two Sum"
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  required
                />
              </div>

              <div className="form-group flex-2">
                <label>Slug (URL key) *</label>
                <input
                  type="text"
                  placeholder="e.g. two-sum"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  required
                />
              </div>

              <div className="form-group flex-1">
                <label>Difficulty *</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group flex-1">
                <label>Tags (comma separated)</label>
                <input
                  type="text"
                  placeholder="Array, Hash Table, Dynamic Programming"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                />
              </div>

              <div className="form-group flex-1">
                <label>Execution Function Name *</label>
                <input
                  type="text"
                  placeholder="e.g. solution"
                  value={formData.functionName}
                  onChange={(e) => setFormData({ ...formData, functionName: e.target.value })}
                />
              </div>

              <div className="form-group flex-1">
                <label>Parameter Names *</label>
                <input
                  type="text"
                  placeholder="nums, target"
                  value={formData.parameters}
                  onChange={(e) => setFormData({ ...formData, parameters: e.target.value })}
                />
              </div>
            </div>
          </div>

          {/* Description & Constraints Markdown */}
          <div className="form-card">
            <h3>📝 Problem Description (Markdown)</h3>
            <textarea
              className="markdown-textarea"
              rows={8}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Write the full problem description in GitHub Flavored Markdown..."
            />

            <h4 style={{ marginTop: "16px", color: "#cbd5e1", fontSize: "14px" }}>
              Constraints (one per line)
            </h4>
            <textarea
              className="markdown-textarea"
              rows={3}
              value={formData.constraints}
              onChange={(e) => setFormData({ ...formData, constraints: e.target.value })}
              placeholder="2 <= nums.length <= 10^4"
            />
          </div>

          {/* Examples Builder */}
          <div className="form-card">
            <div className="card-header-row">
              <h3>💡 Examples</h3>
              <button type="button" className="add-item-btn" onClick={handleAddExample}>
                + Add Example
              </button>
            </div>

            {formData.examples.map((ex, idx) => (
              <div key={idx} className="nested-item-box">
                <div className="nested-header">
                  <span>Example {idx + 1}</span>
                  {formData.examples.length > 1 && (
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => handleRemoveExample(idx)}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Input</label>
                    <input
                      type="text"
                      placeholder="nums = [2,7,11,15], target = 9"
                      value={ex.input}
                      onChange={(e) => handleExampleChange(idx, "input", e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Output</label>
                    <input
                      type="text"
                      placeholder="[0, 1]"
                      value={ex.output}
                      onChange={(e) => handleExampleChange(idx, "output", e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group" style={{ marginTop: "8px" }}>
                  <label>Explanation (Optional)</label>
                  <input
                    type="text"
                    placeholder="Because nums[0] + nums[1] == 9"
                    value={ex.explanation || ""}
                    onChange={(e) => handleExampleChange(idx, "explanation", e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Test Cases Builder */}
          <div className="form-card">
            <div className="card-header-row">
              <div>
                <h3>🧪 Test Case Suite & Hidden Cases</h3>
                <p className="card-subtitle">
                  Hidden test cases are used for final submissions and never shown to regular users.
                </p>
              </div>
              <button type="button" className="add-item-btn" onClick={handleAddTestCase}>
                + Add Test Case
              </button>
            </div>

            {formData.testCases.map((tc, idx) => (
              <div key={idx} className={`nested-item-box ${tc.isHidden ? "hidden-testcase-box" : ""}`}>
                <div className="nested-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span>Case #{idx + 1}</span>
                    {tc.isHidden && <span className="hidden-pill">🔒 Hidden Test Case</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={tc.isHidden}
                        onChange={(e) => handleTestCaseChange(idx, "isHidden", e.target.checked)}
                      />
                      <span>Is Hidden</span>
                    </label>
                    {formData.testCases.length > 1 && (
                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => handleRemoveTestCase(idx)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Input (Raw or JSON)</label>
                    <input
                      type="text"
                      placeholder='[2, 7, 11, 15], 9'
                      value={tc.input}
                      onChange={(e) => handleTestCaseChange(idx, "input", e.target.value)}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Expected Output (Raw or JSON)</label>
                    <input
                      type="text"
                      placeholder='[0, 1]'
                      value={tc.expectedOutput}
                      onChange={(e) => handleTestCaseChange(idx, "expectedOutput", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Multi-Language Starter Code Editor */}
        <div className="editor-side-panel">
          <div className="form-card sticky-editor-card">
            <div className="editor-header-tabs">
              <span style={{ fontSize: "14px", fontWeight: "700", color: "#f8fafc" }}>
                💻 Starter Templates
              </span>
              <div className="lang-tabs">
                {["javascript", "python", "java", "cpp"].map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    className={`lang-tab-btn ${activeCodeTab === lang ? "active" : ""}`}
                    onClick={() => setActiveCodeTab(lang)}
                  >
                    {lang === "cpp" ? "C++" : lang.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            <div className="monaco-wrapper">
              <Editor
                height="420px"
                theme="vs-dark"
                language={activeCodeTab === "cpp" ? "cpp" : activeCodeTab}
                value={formData.starterCode[activeCodeTab]}
                onChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    starterCode: {
                      ...prev.starterCode,
                      [activeCodeTab]: val || "",
                    },
                  }))
                }
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  lineNumbers: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "12px 0 0" }}>
              Admins can customize default boilerplate code for each supported language.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
