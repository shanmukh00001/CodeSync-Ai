import React, { useState, useMemo } from "react";
import "./OutputTerminal.css";

/**
 * OutputTerminal
 * Premium glassmorphic code execution output panel with syntax-highlighted status pills,
 * structured test-case diff cards, telemetry badges, and utility shortcuts (Copy, Clear, Expand/Collapse).
 */
export default function OutputTerminal({
  output = "",
  isRunning = false,
  isSubmitting = false,
  statusSummary = null,
  onClear = null,
  isCollapsed = false,
  onToggleCollapse = null,
  extraHeaderRight = null,
  className = "",
  style = {},
}) {
  const [copied, setCopied] = useState(false);

  // Copy output to clipboard
  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const ta = document.createElement("textarea");
      ta.value = output;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Parse output text into structured format if it's a test runner or submission result
  const parsedData = useMemo(() => {
    if (!output || typeof output !== "string") {
      return { type: "empty" };
    }

    const trimmed = output.trim();

    // Check for initial prompt
    if (
      trimmed === "Run your code to see the output." ||
      trimmed.startsWith("Please wait for problem details") ||
      trimmed.startsWith("Please select a problem first")
    ) {
      return { type: "initial", message: trimmed };
    }

    // Check for running states
    if (
      trimmed.startsWith("Running code on visible test cases") ||
      trimmed.startsWith("Submitting code to full evaluation")
    ) {
      return { type: "in-progress", message: trimmed };
    }

    // Detect status from output
    const isAccepted = trimmed.includes("✓ Accepted") || trimmed.includes("Status: accepted");
    const isWrongAnswer = trimmed.includes("✗ Wrong Answer") || trimmed.includes("Status: wrong_answer");
    const isCompilationError = trimmed.includes("✗ Compilation Error") || trimmed.includes("Status: compilation_error");
    const isRuntimeError = trimmed.includes("✗ Runtime Error") || trimmed.includes("Status: runtime_error") || trimmed.includes("Runtime Error");
    const isTimeLimit = trimmed.includes("✗ Time Limit Exceeded") || trimmed.includes("Status: time_limit_exceeded");
    const isFailed = trimmed.includes("✗ Execution Failed") || trimmed.includes("✗ Submission Failed") || trimmed.includes("✗ Network Error");

    if (isAccepted || isWrongAnswer || isCompilationError || isRuntimeError || isTimeLimit || isFailed) {
      // Extract test cases passed
      const tcMatch = trimmed.match(/•?\s*Test cases:\s*(\d+)\s*\/\s*(\d+)\s*passed/i);
      const passedCount = tcMatch ? tcMatch[1] : null;
      const totalCount = tcMatch ? tcMatch[2] : null;

      // Extract runtime & memory
      const rtMatch = trimmed.match(/•?\s*Runtime:\s*([0-9.]+\s*m?s)/i);
      const memMatch = trimmed.match(/•?\s*Memory:\s*([0-9.]+\s*[KMGT]?B)/i);

      // Extract failed test case index
      const failedTcMatch = trimmed.match(/Failed on test case #(\d+)/i) || trimmed.match(/Timed out on test case #(\d+)/i);
      const failedCaseNum = failedTcMatch ? failedTcMatch[1] : null;

      // Extract Input, Expected, and Your Output sections
      let inputVal = null;
      let expectedVal = null;
      let actualVal = null;

      const inputIdx = trimmed.indexOf("Input:\n");
      const expectedIdx = trimmed.indexOf("Expected Output:\n");
      const actualIdx = trimmed.indexOf("Your Output:\n");

      if (inputIdx !== -1 && expectedIdx !== -1) {
        inputVal = trimmed.substring(inputIdx + 7, expectedIdx).trim();
      }
      if (expectedIdx !== -1) {
        if (actualIdx !== -1) {
          expectedVal = trimmed.substring(expectedIdx + 17, actualIdx).trim();
          actualVal = trimmed.substring(actualIdx + 13).trim();
        } else {
          expectedVal = trimmed.substring(expectedIdx + 17).trim();
        }
      }

      // Extract error details if compilation or runtime error
      let errorBody = null;
      if (isCompilationError || isRuntimeError || isFailed) {
        const lines = trimmed.split("\n");
        // Skip first line if it's the title
        if (lines.length > 1) {
          errorBody = lines.slice(1).join("\n").trim();
        } else {
          errorBody = trimmed;
        }
      }

      return {
        type: "structured",
        status: isAccepted
          ? "Accepted"
          : isWrongAnswer
          ? "Wrong Answer"
          : isCompilationError
          ? "Compilation Error"
          : isRuntimeError
          ? "Runtime Error"
          : isTimeLimit
          ? "Time Limit Exceeded"
          : "Failed",
        passedCount,
        totalCount,
        runtime: rtMatch ? rtMatch[1] : null,
        memory: memMatch ? memMatch[1] : null,
        failedCaseNum,
        inputVal,
        expectedVal,
        actualVal,
        errorBody,
        rawText: trimmed,
      };
    }

    return { type: "raw", text: trimmed };
  }, [output]);

  // Derive status badge config
  const statusBadge = useMemo(() => {
    if (isRunning) {
      return { label: "Running…", type: "running", icon: "⟳" };
    }
    if (isSubmitting) {
      return { label: "Evaluating…", type: "submitting", icon: "⟳" };
    }
    if (statusSummary?.status) {
      const s = statusSummary.status.toLowerCase();
      if (s.includes("accept") || s.includes("pass")) {
        return { label: statusSummary.status, type: "accepted", icon: "✓" };
      }
      if (s.includes("wrong")) {
        return { label: statusSummary.status, type: "wrong", icon: "✗" };
      }
      if (s.includes("error") || s.includes("limit") || s.includes("fail")) {
        return { label: statusSummary.status, type: "error", icon: "✗" };
      }
      return { label: statusSummary.status, type: "neutral", icon: "●" };
    }
    if (parsedData.type === "structured") {
      switch (parsedData.status) {
        case "Accepted":
          return { label: "Accepted", type: "accepted", icon: "✓" };
        case "Wrong Answer":
          return { label: "Wrong Answer", type: "wrong", icon: "✗" };
        case "Compilation Error":
          return { label: "Compilation Error", type: "error", icon: "✗" };
        case "Runtime Error":
          return { label: "Runtime Error", type: "error", icon: "✗" };
        case "Time Limit Exceeded":
          return { label: "Time Limit Exceeded", type: "warning", icon: "⏱" };
        default:
          return { label: parsedData.status, type: "error", icon: "✗" };
      }
    }
    if (parsedData.type === "raw") {
      return { label: "Executed", type: "neutral", icon: "●" };
    }
    return { label: "Ready", type: "idle", icon: "●" };
  }, [isRunning, isSubmitting, statusSummary, parsedData]);

  return (
    <div
      className={`output-terminal-wrapper ${isCollapsed ? "is-collapsed" : ""} ${className}`}
      style={style}
    >
      {/* Top Glass Header */}
      <div className="output-terminal-header">
        <div className="output-terminal-header-left">
          <div className="output-terminal-title-group">
            <span className="output-terminal-glyph" aria-hidden="true">&gt;_</span>
            <span className="output-terminal-title">OUTPUT</span>
          </div>

          <span className={`output-status-pill is-${statusBadge.type}`}>
            <span className="output-status-dot" aria-hidden="true" />
            <span className="output-status-icon">{statusBadge.icon}</span>
            <span className="output-status-label">{statusBadge.label}</span>
          </span>
        </div>

        <div className="output-terminal-header-right">
          {extraHeaderRight}

          {/* Action buttons */}
          <div className="output-terminal-actions">
            <button
              type="button"
              className={`output-action-btn ${copied ? "is-copied" : ""}`}
              onClick={handleCopy}
              title="Copy output to clipboard"
              aria-label="Copy output"
              disabled={!output || isRunning || isSubmitting}
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>

            {onClear && (
              <button
                type="button"
                className="output-action-btn"
                onClick={onClear}
                title="Clear output console"
                aria-label="Clear output"
                disabled={!output || isRunning || isSubmitting}
              >
                ⊘ Clear
              </button>
            )}

            {onToggleCollapse && (
              <button
                type="button"
                className="output-action-btn output-toggle-collapse-btn"
                onClick={onToggleCollapse}
                aria-expanded={!isCollapsed}
                title={isCollapsed ? "Expand output panel" : "Collapse output panel"}
              >
                <span className="output-collapse-icon" aria-hidden="true">
                  {isCollapsed ? "▲" : "▼"}
                </span>
                <span>{isCollapsed ? "Expand" : "Collapse"}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Terminal Body */}
      {!isCollapsed && (
        <div className="output-terminal-body" tabIndex={0} role="region" aria-label="Execution Output Console">
          {/* 1. Initial State */}
          {parsedData.type === "initial" && (
            <div className="output-terminal-empty">
              <div className="output-prompt-line">
                <span className="output-prompt-sym">$</span>
                <span className="output-prompt-cmd">codesync --engine=piston --status=ready</span>
              </div>
              <div className="output-prompt-hint">
                <span className="output-prompt-sub">&gt;</span> {parsedData.message}
              </div>
              <div className="output-prompt-shortcuts">
                <span className="output-shortcut-chip">Tip: Click <strong>Run</strong> to test or <strong>Submit</strong> for full evaluation</span>
              </div>
            </div>
          )}

          {/* 2. In-Progress State */}
          {parsedData.type === "in-progress" && (
            <div className="output-terminal-loading">
              <div className="output-loading-spinner" />
              <div className="output-loading-text">{parsedData.message}</div>
            </div>
          )}

          {/* 3. Structured Problem Execution / Submission */}
          {parsedData.type === "structured" && (
            <div className="output-structured-view">
              {/* Telemetry Chips Bar */}
              <div className="output-telemetry-bar">
                {parsedData.passedCount !== null && (
                  <div className={`output-telemetry-chip ${parsedData.status === "Accepted" ? "is-success" : "is-wrong"}`}>
                    <span className="telemetry-label">Tests Passed:</span>
                    <span className="telemetry-value">
                      {parsedData.passedCount} / {parsedData.totalCount}
                    </span>
                  </div>
                )}
                {parsedData.runtime && (
                  <div className="output-telemetry-chip">
                    <span className="telemetry-icon">⚡</span>
                    <span className="telemetry-label">Runtime:</span>
                    <span className="telemetry-value">{parsedData.runtime}</span>
                  </div>
                )}
                {parsedData.memory && (
                  <div className="output-telemetry-chip">
                    <span className="telemetry-icon">💾</span>
                    <span className="telemetry-label">Memory:</span>
                    <span className="telemetry-value">{parsedData.memory}</span>
                  </div>
                )}
                {parsedData.failedCaseNum && (
                  <div className="output-telemetry-chip is-wrong">
                    <span className="telemetry-label">Failed at:</span>
                    <span className="telemetry-value">Case #{parsedData.failedCaseNum}</span>
                  </div>
                )}
              </div>

              {/* Diff Cards for Wrong Answer */}
              {(parsedData.inputVal !== null || parsedData.expectedVal !== null || parsedData.actualVal !== null) && (
                <div className="output-diff-grid">
                  {parsedData.inputVal !== null && (
                    <div className="output-diff-card is-input">
                      <div className="output-diff-title">
                        <span className="output-diff-tag">Input</span>
                      </div>
                      <pre className="output-diff-pre">{parsedData.inputVal}</pre>
                    </div>
                  )}

                  {parsedData.expectedVal !== null && (
                    <div className="output-diff-card is-expected">
                      <div className="output-diff-title">
                        <span className="output-diff-tag">Expected Output</span>
                      </div>
                      <pre className="output-diff-pre">{parsedData.expectedVal}</pre>
                    </div>
                  )}

                  {parsedData.actualVal !== null && (
                    <div className="output-diff-card is-actual">
                      <div className="output-diff-title">
                        <span className="output-diff-tag">Your Output</span>
                      </div>
                      <pre className="output-diff-pre">{parsedData.actualVal}</pre>
                    </div>
                  )}
                </div>
              )}

              {/* Compilation / Runtime Error Diagnostics */}
              {parsedData.errorBody && (
                <div className="output-error-container">
                  <div className="output-error-header">
                    <span className="output-error-badge">Diagnostics</span>
                    <span className="output-error-title">{parsedData.status}</span>
                  </div>
                  <pre className="output-error-pre">{parsedData.errorBody}</pre>
                </div>
              )}

              {/* If Accepted with no extra diff, show clean celebration banner */}
              {parsedData.status === "Accepted" && !parsedData.errorBody && !parsedData.inputVal && (
                <div className="output-accepted-banner">
                  <div className="accepted-banner-icon">✓</div>
                  <div className="accepted-banner-content">
                    <div className="accepted-banner-headline">All Visible Tests Passed!</div>
                    <div className="accepted-banner-sub">Your solution produced correct results for all evaluated test cases.</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 4. Raw Console Output (e.g. general code output / custom prints) */}
          {parsedData.type === "raw" && (
            <div className="output-terminal-raw">
              <pre className="output-raw-pre">
                {parsedData.text.split("\n").map((line, idx) => {
                  const isErr =
                    line.toLowerCase().includes("error") ||
                    line.toLowerCase().includes("exception") ||
                    line.toLowerCase().includes("failed");
                  const isSuccess =
                    line.toLowerCase().includes("success") ||
                    line.toLowerCase().includes("passed") ||
                    line.toLowerCase().includes("accepted");
                  return (
                    <div
                      key={idx}
                      className={`output-raw-line ${isErr ? "is-error-line" : ""} ${
                        isSuccess ? "is-success-line" : ""
                      }`}
                    >
                      <span className="output-raw-gutter">{idx + 1}</span>
                      <span className="output-raw-text">{line || " "}</span>
                    </div>
                  );
                })}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
