import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubmissionsView from "../components/SubmissionsView";
import "./ProblemWorkspace.css";

const LANGUAGE_OPTIONS = [
  { key: "javascript", label: "JavaScript" },
  { key: "python", label: "Python" },
  { key: "java", label: "Java" },
  { key: "cpp", label: "C++" },
];

// ================= RESIZABLE PANELS =================
// Layout bounds for the problem/editor split (as a fraction of workspace width).
const MIN_PROBLEM_FRACTION = 0.3;
const MAX_PROBLEM_FRACTION = 0.7;
// Minimum pixel sizes for editor and output sub-topels (inside the right panel).
const MIN_EDITOR_HEIGHT = 200;
const MIN_OUTPUT_HEIGHT = 120;
// localStorage keys used to persist the user's preferred panel sizes.
const LS_PROBLEM_WIDTH = "codesync-problem-panel-width";
const LS_OUTPUT_HEIGHT = "codesync-output-panel-height";

function ProblemWorkspace() {
  const navigate = useNavigate();
  // Get the problem slug from the URL
  const { slug } = useParams();

  // Store the problem data
  const [problem, setProblem] = useState(null);

  // Left panel view tab: "description" | "submissions"
  const [activeTab, setActiveTab] = useState("description");

  // Language & Code per language state
  const [selectedLanguage, setSelectedLanguage] = useState("cpp");
  const [userCode, setUserCode] = useState({
    javascript: "",
    python: "",
    java: "",
    cpp: "",
  });

  // Output panel state & execution
  const [output, setOutput] = useState("Run your code to see the output.");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionHistoryVersion, setSubmissionHistoryVersion] = useState(0);
  const executionTokenRef = useRef(0);

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---------------- Resizable panels state ----------------
  // Fraction (0-1) of the workspace width occupied by the problem (left) panel.
  const [problemFraction, setProblemFraction] = useState(() => {
    const saved = parseFloat(localStorage.getItem(LS_PROBLEM_WIDTH));
    return Number.isFinite(saved) ? saved : 0.5;
  });
  // Pixel height of the output (bottom) panel inside the right side.
  const [outputHeight, setOutputHeight] = useState(() => {
    const saved = parseInt(localStorage.getItem(LS_OUTPUT_HEIGHT), 10);
    return Number.isFinite(saved) && saved >= MIN_OUTPUT_HEIGHT
      ? saved
      : 220;
  });

  // Refs for measuring the workspace during drag.
  const workspaceRef = useRef(null);
  const editorPanelRef = useRef(null);
  // Tracks the currently active drag mode (or null if no drag is happening).
  const dragStateRef = useRef(null);

  // Persist layout preferences so the user's split survives reloads.
  useEffect(() => {
    localStorage.setItem(LS_PROBLEM_WIDTH, String(problemFraction));
  }, [problemFraction]);

  useEffect(() => {
    localStorage.setItem(LS_OUTPUT_HEIGHT, String(outputHeight));
  }, [outputHeight]);

  useEffect(() => {
    const fetchProblem = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/problems/${slug}`
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error?.message ||
            data?.message ||
            "Failed to fetch problem"
          );
        }

        const fetchedProblem = data.problem;
        setProblem(fetchedProblem);

        // Invalidate execution token on problem change
        executionTokenRef.current += 1;
        setIsRunning(false);
        setIsSubmitting(false);

        // Parse starter code
        let initialCodeMap = {
          javascript: "",
          python: "",
          java: "",
          cpp: "",
        };

        if (fetchedProblem?.starterCode) {
          if (typeof fetchedProblem.starterCode === "object" && fetchedProblem.starterCode !== null) {
            initialCodeMap = {
              javascript: fetchedProblem.starterCode.javascript || "",
              python: fetchedProblem.starterCode.python || "",
              java: fetchedProblem.starterCode.java || "",
              cpp: fetchedProblem.starterCode.cpp || "",
            };
          } else if (typeof fetchedProblem.starterCode === "string") {
            initialCodeMap.javascript = fetchedProblem.starterCode;
          }
        }

        setUserCode(initialCodeMap);

        // Select initial language based on available code (prefer cpp)
        const availableLangs = Object.keys(initialCodeMap).filter(
          (lang) => initialCodeMap[lang] && initialCodeMap[lang].trim() !== ""
        );

        if (availableLangs.length > 0) {
          if (initialCodeMap.cpp) {
            setSelectedLanguage("cpp");
          } else if (initialCodeMap.javascript) {
            setSelectedLanguage("javascript");
          } else {
            setSelectedLanguage(availableLangs[0]);
          }
        } else {
          setSelectedLanguage("cpp");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProblem();
  }, [slug]);

  const handleLanguageChange = (e) => {
    setSelectedLanguage(e.target.value);
  };

  const handleCodeChange = (e) => {
    const value = e.target.value;
    setUserCode((prev) => ({
      ...prev,
      [selectedLanguage]: value,
    }));
  };

  const formatExecutionResult = (res) => {
    if (!res) return "No execution result returned.";
    const status = res.status || "unknown";
    const passed = typeof res.passedTestCases === "number" ? res.passedTestCases : 0;
    const total = typeof res.totalTestCases === "number" ? res.totalTestCases : 0;
    const runtime = typeof res.runtimeMs === "number" ? `${res.runtimeMs} ms` : null;
    const memory = typeof res.memoryKb === "number" ? `${res.memoryKb} KB` : null;

    if (status === "accepted") {
      let text = `✓ Accepted\n\n`;
      text += `• Test cases: ${passed} / ${total} passed\n`;
      if (runtime) text += `• Runtime: ${runtime}\n`;
      if (memory) text += `• Memory: ${memory}\n`;
      return text.trim();
    }

    if (status === "wrong_answer") {
      let text = `✗ Wrong Answer\n\n`;
      text += `• Test cases: ${passed} / ${total} passed\n`;
      if (res.failedTestCase) {
        const ft = res.failedTestCase;
        const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
        text += `• Failed on test case #${testIdx}\n\n`;
        if (ft.isHidden === true) {
          text += `Note: Hidden test failed\n`;
        } else {
          if (ft.input !== undefined && ft.input !== null) {
            text += `Input:\n${typeof ft.input === "object" ? JSON.stringify(ft.input, null, 2) : ft.input}\n\n`;
          }
          if (ft.expected !== undefined && ft.expected !== null) {
            text += `Expected Output:\n${typeof ft.expected === "object" ? JSON.stringify(ft.expected, null, 2) : ft.expected}\n\n`;
          }
          if (ft.actual !== undefined && ft.actual !== null) {
            text += `Your Output:\n${typeof ft.actual === "object" ? JSON.stringify(ft.actual, null, 2) : ft.actual}\n`;
          }
        }
      }
      return text.trim();
    }

    if (status === "compilation_error") {
      let text = `✗ Compilation Error\n\n`;
      if (res.error) {
        text += `${res.error}\n`;
      } else {
        text += `Code failed to compile.\n`;
      }
      return text.trim();
    }

    if (status === "runtime_error") {
      let text = `✗ Runtime Error\n\n`;
      if (res.error) {
        text += `${res.error}\n`;
      } else if (res.failedTestCase?.errorMessage) {
        text += `${res.failedTestCase.errorMessage}\n`;
      } else {
        text += `Program encountered a runtime error during execution.\n`;
      }
      return text.trim();
    }

    if (status === "time_limit_exceeded") {
      let text = `✗ Time Limit Exceeded\n\n`;
      text += `• Execution timed out.\n`;
      if (res.failedTestCase) {
        const ft = res.failedTestCase;
        const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
        text += `• Timed out on test case #${testIdx}\n`;
      }
      return text.trim();
    }

    if (status === "internal_error") {
      return `✗ Execution Engine Error\n\nThe code execution service encountered an internal error. Please try again.`;
    }

    return `Status: ${status}\n• Test cases: ${passed} / ${total} passed`;
  };

  const formatSubmissionResult = (sub) => {
    if (!sub) return "No submission result returned.";
    const status = sub.status || "Unknown";
    const passed = typeof sub.passedTestCases === "number" ? sub.passedTestCases : 0;
    const total = typeof sub.totalTestCases === "number" ? sub.totalTestCases : 0;
    const runtime = typeof sub.runtimeMs === "number" && sub.runtimeMs > 0 ? `${sub.runtimeMs} ms` : null;
    const memory = typeof sub.memoryKb === "number" && sub.memoryKb > 0 ? `${sub.memoryKb} KB` : null;

    let text = "";
    if (status === "Accepted") {
      text += `✓ Accepted\n\n`;
      text += `• Test cases: ${passed} / ${total} passed\n`;
      if (runtime) text += `• Runtime: ${runtime}\n`;
      if (memory) text += `• Memory: ${memory}\n`;
    } else if (status === "Wrong Answer") {
      text += `✗ Wrong Answer\n\n`;
      text += `• Test cases: ${passed} / ${total} passed\n`;
      if (sub.failedTestCase) {
        const ft = sub.failedTestCase;
        const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
        text += `• Failed on test case #${testIdx}\n\n`;
        if (ft.isHidden === true) {
          text += `Note: Hidden test failed\n`;
        } else {
          if (ft.input !== undefined && ft.input !== null) {
            text += `Input:\n${typeof ft.input === "object" ? JSON.stringify(ft.input, null, 2) : ft.input}\n\n`;
          }
          if (ft.expected !== undefined && ft.expected !== null) {
            text += `Expected Output:\n${typeof ft.expected === "object" ? JSON.stringify(ft.expected, null, 2) : ft.expected}\n\n`;
          }
          if (ft.actual !== undefined && ft.actual !== null) {
            text += `Your Output:\n${typeof ft.actual === "object" ? JSON.stringify(ft.actual, null, 2) : ft.actual}\n`;
          }
        }
      }
    } else if (status === "Compilation Error") {
      text += `✗ Compilation Error\n\n`;
      if (sub.error) {
        text += `${sub.error}\n`;
      } else {
        text += `Code failed to compile.\n`;
      }
    } else if (status === "Runtime Error") {
      text += `✗ Runtime Error\n\n`;
      if (sub.error) {
        text += `${sub.error}\n`;
      } else if (sub.failedTestCase?.errorMessage) {
        text += `${sub.failedTestCase.errorMessage}\n`;
      } else {
        text += `Program encountered a runtime error during execution.\n`;
      }
    } else if (status === "Time Limit Exceeded") {
      text += `✗ Time Limit Exceeded\n\n`;
      text += `• Execution timed out.\n`;
      if (sub.failedTestCase) {
        const ft = sub.failedTestCase;
        const testIdx = typeof ft.testCaseIndex === "number" ? ft.testCaseIndex + 1 : "?";
        text += `• Timed out on test case #${testIdx}\n`;
      }
    } else {
      text += `Status: ${status}\n• Test cases: ${passed} / ${total} passed\n`;
    }

    return text.trim();
  };

  const handleRunCode = async () => {
    if (isRunning || isSubmitting) return;

    if (!problem?._id) {
      setOutput("Please wait for problem details to load before running code.");
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsRunning(true);
    setOutput("Running code on visible test cases…");

    const codeSnapshot = userCode[selectedLanguage] || "";
    const problemIdSnapshot = problem._id;
    const languageSnapshot = selectedLanguage;

    try {
      const response = await fetch("http://localhost:5000/api/submissions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      if (executionTokenRef.current !== currentToken) {
        return;
      }

      if (response.ok && data?.result) {
        setOutput(formatExecutionResult(data.result));
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          (response.status === 401
            ? "Authentication error. Please log in again."
            : response.status === 404
            ? "Problem not found."
            : response.status === 400
            ? "Validation error in execution request."
            : "Execution engine error. Please try again.");
        setOutput(`✗ Execution Failed\n\n${errorMsg}`);
      }
    } catch {
      if (executionTokenRef.current === currentToken) {
        setOutput(
          "✗ Network Error\n\nCould not connect to the execution server. Please check your connection and try again."
        );
      }
    } finally {
      if (executionTokenRef.current === currentToken) {
        setIsRunning(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (isRunning || isSubmitting) return;

    if (!problem?._id) {
      setOutput("Please wait for problem details to load before submitting.");
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsSubmitting(true);
    setOutput("Submitting code to full evaluation pipeline…");

    const codeSnapshot = userCode[selectedLanguage] || "";
    const problemIdSnapshot = problem._id;
    const languageSnapshot = selectedLanguage;

    try {
      const response = await fetch("http://localhost:5000/api/submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      if (executionTokenRef.current !== currentToken) {
        return;
      }

      if (response.ok && data?.submission) {
        setOutput(formatSubmissionResult(data.submission));
        setSubmissionHistoryVersion((v) => v + 1);
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          (response.status === 401
            ? "Authentication error. Please log in again."
            : response.status === 404
            ? "Problem not found."
            : response.status === 400
            ? "Validation error in submission request."
            : "Submission evaluation error. Please try again.");
        setOutput(`✗ Submission Failed\n\n${errorMsg}`);
      }
    } catch {
      if (executionTokenRef.current === currentToken) {
        setOutput(
          "✗ Network Error\n\nCould not connect to the submission server. Please check your connection and try again."
        );
      }
    } finally {
      if (executionTokenRef.current === currentToken) {
        setIsSubmitting(false);
      }
    }
  };

  // ================= RESIZABLE PANELS =================
  // Shared pointermove handler used while a resize drag is active.
  const handlePointerMove = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state) return;

    if (state.mode === "vertical") {
      // Dragging the divider between problem and editor: convert x delta to a width fraction.
      const workspace = workspaceRef.current;
      if (!workspace) return;
      const rect = workspace.getBoundingClientRect();
      const rawFraction = (event.clientX - rect.left) / rect.width;
      const clamped = Math.min(
        MAX_PROBLEM_FRACTION,
        Math.max(MIN_PROBLEM_FRACTION, rawFraction)
      );
      setProblemFraction(clamped);
    } else if (state.mode === "horizontal") {
      // Dragging the divider between editor and output: convert y delta to an output height.
      const panel = editorPanelRef.current;
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      const panelBottom = rect.bottom;
      // Distance from cursor to the bottom of the right panel is the output height.
      const rawHeight = panelBottom - event.clientY;
      const maxHeight = rect.height - MIN_EDITOR_HEIGHT;
      const clamped = Math.min(
        maxHeight,
        Math.max(MIN_OUTPUT_HEIGHT, rawHeight)
      );
      setOutputHeight(clamped);
    }
  }, []);

  // Shared pointerup handler: releases pointer capture and clears drag state.
  const handlePointerUp = useCallback((event) => {
    const state = dragStateRef.current;
    if (!state) return;
    try {
      event.target.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released; safe to ignore.
    }
    dragStateRef.current = null;
    document.body.classList.remove("workspace-dragging");
  }, []);

  // Begin a vertical drag (problem vs editor split).
  const startVerticalDrag = (event) => {
    // Ignore non-primary mouse buttons; pointer events still treat touch/pen as primary.
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    dragStateRef.current = { mode: "vertical" };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Some environments throw if capture fails; pointerup will still clean up.
    }
    document.body.classList.add("workspace-dragging");
  };

  // Begin a horizontal drag (editor vs output split).
  const startHorizontalDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    dragStateRef.current = { mode: "horizontal" };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Ignore capture failure; pointerup will still reset drag state.
    }
    document.body.classList.add("workspace-dragging");
  };

  // Safety net: if the pointer is released outside the handle, clear any lingering state.
  useEffect(() => {
    const cancelDrag = () => {
      if (!dragStateRef.current) return;
      dragStateRef.current = null;
      document.body.classList.remove("workspace-dragging");
    };
    window.addEventListener("pointerup", cancelDrag);
    window.addEventListener("pointercancel", cancelDrag);
    return () => {
      window.removeEventListener("pointerup", cancelDrag);
      window.removeEventListener("pointercancel", cancelDrag);
      document.body.classList.remove("workspace-dragging");
    };
  }, []);

  if (loading) {
    return (
      <div className="workspace-status-container">
        <div className="loading-spinner"></div>
        <h2>Loading problem...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="workspace-status-container error">
        <h2>Error Loading Problem</h2>
        <p>{error}</p>
      </div>
    );
  }

  const difficultyClass = `difficulty-${problem.difficulty?.toLowerCase() || "easy"}`;

  // CSS variables that drive the dynamic panel sizing.
  const workspaceStyle = {
    "--problem-fraction": problemFraction,
    "--output-height": `${outputHeight}px`,
  };

  return (
    <div
      className="problem-workspace"
      ref={workspaceRef}
      style={workspaceStyle}
    >
      {/* LEFT SIDE - Problem details or Submissions */}
      <section className="problem-panel">
        <div className="workspace-tabs-header">
          <button
            type="button"
            className="workspace-back-btn"
            onClick={() => navigate("/dashboard")}
            aria-label="Back to Dashboard"
            title="Back to Dashboard"
          >
            ←
          </button>
          <div className="workspace-nav-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "description"}
              className={`workspace-tab-btn ${
                activeTab === "description" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("description")}
            >
              📄 Description
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "submissions"}
              className={`workspace-tab-btn ${
                activeTab === "submissions" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("submissions")}
            >
              📋 Submissions
            </button>
          </div>
        </div>

        {activeTab === "submissions" ? (
          <SubmissionsView
            problemId={problem._id}
            currentLanguage={selectedLanguage}
            refreshTrigger={submissionHistoryVersion}
          />
        ) : (
          <div className="problem-content-scroll">
            <div className="problem-header">
              <h1 className="problem-title">{problem.title}</h1>
              <span className={`difficulty-badge ${difficultyClass}`}>
                {problem.difficulty}
              </span>
            </div>

            <div className="problem-section">
              <h2 className="section-title">Description</h2>
              <div className="problem-description">{problem.description}</div>
            </div>

            {problem.examples && problem.examples.length > 0 && (
              <div className="problem-section">
                <h2 className="section-title">Examples</h2>
                {problem.examples.map((example, index) => (
                  <div key={index} className="example-card">
                    <div className="example-header">Example {index + 1}</div>
                    <div className="example-content">
                      <p>
                        <strong>Input:</strong> <code>{example.input}</code>
                      </p>
                      <p>
                        <strong>Output:</strong> <code>{example.output}</code>
                      </p>
                      {example.explanation && (
                        <p>
                          <strong>Explanation:</strong> {example.explanation}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {problem.constraints && problem.constraints.length > 0 && (
              <div className="problem-section">
                <h2 className="section-title">Constraints</h2>
                <ul className="constraints-list">
                  {problem.constraints.map((constraint, index) => (
                    <li key={index}>
                      <code>{constraint}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {problem.tags && problem.tags.length > 0 && (
              <div className="problem-section tags-section">
                <h2 className="section-title">Tags</h2>
                <div className="tags-container">
                  {problem.tags.map((tag, index) => (
                    <span key={index} className="tag-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ================= RESIZABLE PANELS ================= */}
      {/* Vertical drag handle between problem and editor panels. */}
      <div
        className="resize-handle resize-handle-vertical"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize problem and editor panels"
        onPointerDown={startVerticalDrag}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="resize-handle-grip" />
      </div>

      {/* RIGHT SIDE - Code editor */}
      <section className="editor-panel" ref={editorPanelRef}>
        <div className="editor-toolbar">
          <div className="toolbar-left">
            <label htmlFor="language-select" className="toolbar-label">
              Language:
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="language-select"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.key} value={lang.key}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <div className="toolbar-right">
            <button
              type="button"
              className="btn btn-run"
              onClick={handleRunCode}
              disabled={isRunning || isSubmitting}
            >
              {isRunning ? "Running…" : "Run Code"}
            </button>
            <button
              type="button"
              className="btn btn-submit"
              onClick={handleSubmit}
              disabled={isRunning || isSubmitting}
            >
              {isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

        <div className="editor-container">
          <textarea
            value={userCode[selectedLanguage] || ""}
            onChange={handleCodeChange}
            className="code-editor"
            placeholder="Write your solution here..."
            spellCheck="false"
          />
        </div>

        {/* ================= RESIZABLE PANELS ================= */}
        {/* Horizontal drag handle between editor and output panels. */}
        <div
          className="resize-handle resize-handle-horizontal"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize editor and output panels"
          onPointerDown={startHorizontalDrag}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <span className="resize-handle-grip" />
        </div>

        <div className="output-panel">
          <div className="output-header">
            <span>Output</span>
          </div>
          <div className="output-content">
            <pre>{output}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

export default ProblemWorkspace;