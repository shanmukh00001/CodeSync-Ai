import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import SubmissionsView from "../components/SubmissionsView";
import AIReviewPanel from "../components/AIReviewPanel";
import AIHintPanel from "../components/AIHintPanel";
import MonacoCodeEditor from "../components/MonacoCodeEditor";
import OutputTerminal from "../components/common/OutputTerminal";
import { API_BASE_URL } from "../config/api";
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

  // Left panel view tab: "description" | "submissions" | "review" | "hint"
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
  const [isOutputCollapsed, setIsOutputCollapsed] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastExecutionSummary, setLastExecutionSummary] = useState(null);
  const [submissionHistoryVersion, setSubmissionHistoryVersion] = useState(0);
  const executionTokenRef = useRef(0);

  // AI Review state
  const [aiReview, setAiReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [aiReviewError, setAiReviewError] = useState("");
  const [reviewCooldown, setReviewCooldown] = useState(0);
  const reviewTokenRef = useRef(0);
  const cooldownTimerRef = useRef(null);

  // AI Hint state
  const [aiHint, setAiHint] = useState(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [aiHintError, setAiHintError] = useState("");
  const [hintCooldown, setHintCooldown] = useState(0);
  const hintTokenRef = useRef(0);
  const hintCooldownTimerRef = useRef(null);


  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showFeatures, setShowFeatures] = useState(false);

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
          `${API_BASE_URL}/api/problems/${slug}`
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

        // Invalidate execution, review, and hint tokens on problem change
        executionTokenRef.current += 1;
        reviewTokenRef.current += 1;
        hintTokenRef.current += 1;
        setIsRunning(false);
        setIsSubmitting(false);
        setIsReviewing(false);
        setIsHintLoading(false);
        setActiveTab("description");

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

        // Check for saved local drafts per language for this problem
        const problemKey = fetchedProblem.slug || fetchedProblem._id || slug;
        const languages = ["javascript", "python", "java", "cpp"];
        for (const lang of languages) {
          const savedDraft = localStorage.getItem(`codesync:solo_code_${problemKey}_${lang}`);
          if (savedDraft !== null && savedDraft.trim() !== "") {
            initialCodeMap[lang] = savedDraft;
          }
        }

        setUserCode(initialCodeMap);

        // Check for saved user language preference for this problem or global preference
        const savedPrefLang = localStorage.getItem(`codesync:last_lang_${problemKey}`) || localStorage.getItem("codesync:preferred_language");

        // Select initial language based on preference or available code
        const availableLangs = Object.keys(initialCodeMap).filter(
          (lang) => initialCodeMap[lang] && initialCodeMap[lang].trim() !== ""
        );

        if (savedPrefLang && ["javascript", "python", "java", "cpp"].includes(savedPrefLang)) {
          setSelectedLanguage(savedPrefLang);
        } else if (availableLangs.length > 0) {
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

  // Restore saved AI Hint and AI Review on problem or language change
  useEffect(() => {
    if (!problem) return;
    const problemKey = problem.slug || problem._id || slug;
    if (!problemKey) return;

    // Restore Hint
    try {
      const savedHintStr =
        localStorage.getItem(`codesync:ai_hint_${problemKey}_${selectedLanguage}`) ||
        localStorage.getItem(`codesync:ai_hint_${problemKey}`);
      if (savedHintStr) {
        const parsedHint = JSON.parse(savedHintStr);
        if (parsedHint && typeof parsedHint === "object") {
          setAiHint(parsedHint);
          setAiHintError("");
        }
      } else {
        setAiHint(null);
      }
    } catch {
      // Ignore parse errors
    }

    // Restore Review
    try {
      const savedReviewStr =
        localStorage.getItem(`codesync:ai_review_${problemKey}_${selectedLanguage}`) ||
        localStorage.getItem(`codesync:ai_review_${problemKey}`);
      if (savedReviewStr) {
        const parsedReview = JSON.parse(savedReviewStr);
        if (parsedReview && typeof parsedReview === "object") {
          setAiReview(parsedReview);
          setAiReviewError("");
        }
      } else {
        setAiReview(null);
      }
    } catch {
      // Ignore parse errors
    }
  }, [problem, selectedLanguage, slug]);

  const handleLanguageChange = (e) => {
    const newLang = e.target.value;
    setSelectedLanguage(newLang);
    localStorage.setItem("codesync:preferred_language", newLang);
    if (problem) {
      const problemKey = problem.slug || problem._id || slug;
      localStorage.setItem(`codesync:last_lang_${problemKey}`, newLang);
    }
  };

  const handleCodeChange = (newVal) => {
    const value = typeof newVal === "string" ? newVal : newVal?.target?.value ?? "";
    setUserCode((prev) => ({
      ...prev,
      [selectedLanguage]: value,
    }));
    // Auto-save local draft
    if (problem) {
      const problemKey = problem.slug || problem._id || slug;
      localStorage.setItem(`codesync:solo_code_${problemKey}_${selectedLanguage}`, value);
    }
  };

  const handleResetCode = () => {
    if (!problem) return;
    if (window.confirm(`Reset ${selectedLanguage.toUpperCase()} code to default starter template? Current edits will be overwritten.`)) {
      let defaultCode = "";
      if (problem.starterCode) {
        if (typeof problem.starterCode === "object") {
          defaultCode = problem.starterCode[selectedLanguage] || "";
        } else if (typeof problem.starterCode === "string" && selectedLanguage === "javascript") {
          defaultCode = problem.starterCode;
        }
      }
      handleCodeChange(defaultCode);
    }
  };

  const handleSaveCode = useCallback(() => {
    if (problem) {
      const problemKey = problem.slug || problem._id || slug;
      const currentCode = userCode[selectedLanguage] || "";
      localStorage.setItem(`codesync:solo_code_${problemKey}_${selectedLanguage}`, currentCode);
      setSaveFeedback(true);
      setTimeout(() => setSaveFeedback(false), 2000);
    }
  }, [problem, slug, selectedLanguage, userCode]);

  // Window-level Ctrl+S / Cmd+S shortcut to save draft
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSaveCode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSaveCode]);

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
      const response = await fetch(`${API_BASE_URL}/api/submissions/run`, {
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
        const res = data.result;
        setLastExecutionSummary({
          status: res.status === "accepted" ? "Accepted" : res.status === "wrong_answer" ? "Wrong Answer" : res.status === "compilation_error" ? "Compilation Error" : res.status === "runtime_error" ? "Runtime Error" : res.status === "time_limit_exceeded" ? "Time Limit Exceeded" : "Error",
          passedTestCases: typeof res.passedTestCases === "number" ? res.passedTestCases : 0,
          totalTestCases: typeof res.totalTestCases === "number" ? res.totalTestCases : 0,
          runtimeMs: typeof res.runtimeMs === "number" ? res.runtimeMs : undefined,
          memoryKb: typeof res.memoryKb === "number" ? res.memoryKb : undefined,
        });
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
      const response = await fetch(`${API_BASE_URL}/api/submissions/submit`, {
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
        const sub = data.submission;
        setLastExecutionSummary({
          status: sub.status || "Unknown",
          passedTestCases: typeof sub.passedTestCases === "number" ? sub.passedTestCases : 0,
          totalTestCases: typeof sub.totalTestCases === "number" ? sub.totalTestCases : 0,
          runtimeMs: typeof sub.runtimeMs === "number" ? sub.runtimeMs : undefined,
          memoryKb: typeof sub.memoryKb === "number" ? sub.memoryKb : undefined,
        });
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

  // Cooldown timer interval cleanup on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (hintCooldownTimerRef.current) {
        clearInterval(hintCooldownTimerRef.current);
        hintCooldownTimerRef.current = null;
      }
    };
  }, []);

  const handleGetHint = async () => {
    if (isHintLoading || hintCooldown > 0) return;

    if (!problem?._id) {
      setAiHintError("Please wait for problem details to load before requesting a hint.");
      setActiveTab("hint");
      return;
    }

    const currentCode = userCode[selectedLanguage] || "";

    // Invalidate prior hint requests
    const currentToken = hintTokenRef.current + 1;
    hintTokenRef.current = currentToken;

    setIsHintLoading(true);
    setAiHintError("");
    setActiveTab("hint");

    // Start 5-second client-side cooldown
    setHintCooldown(5);
    if (hintCooldownTimerRef.current) clearInterval(hintCooldownTimerRef.current);
    hintCooldownTimerRef.current = setInterval(() => {
      setHintCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(hintCooldownTimerRef.current);
          hintCooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const codeSnapshot = currentCode;
    const problemIdSnapshot = problem._id;
    const languageSnapshot = selectedLanguage;
    const executionSummarySnapshot = lastExecutionSummary || undefined;

    try {
      const response = await fetch(`${API_BASE_URL}/api/submissions/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
          lastExecutionResult: executionSummarySnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      if (hintTokenRef.current !== currentToken) {
        return;
      }

      if (response.ok && data?.hint) {
        setAiHint(data.hint);
        setAiHintError("");
        const problemKey = problem?.slug || problem?._id || slug;
        if (problemKey) {
          try {
            localStorage.setItem(`codesync:ai_hint_${problemKey}_${selectedLanguage}`, JSON.stringify(data.hint));
            localStorage.setItem(`codesync:ai_hint_${problemKey}`, JSON.stringify(data.hint));
          } catch {
            // Ignore quota errors
          }
        }
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          (response.status === 429
            ? "AI hint rate limit reached. Please wait a minute before requesting another hint."
            : response.status === 503
            ? "AI hint service is temporarily unavailable."
            : response.status === 504
            ? "AI hint request timed out. Please try again."
            : response.status === 502
            ? "AI hint could not be generated. Please try again."
            : response.status === 401
            ? "Authentication required. Please log in again."
            : response.status === 400
            ? "Validation error in hint request."
            : "AI hint service error. Please try again.");
        setAiHintError(errorMsg);
      }
    } catch {
      if (hintTokenRef.current === currentToken) {
        setAiHintError("Could not connect to the AI hint service. Please check your connection and try again.");
      }
    } finally {
      if (hintTokenRef.current === currentToken) {
        setIsHintLoading(false);
      }
    }
  };

  const handleReviewCode = async () => {
    if (isReviewing || reviewCooldown > 0) return;

    if (!problem?._id) {
      setAiReviewError("Please wait for problem details to load before requesting a review.");
      setActiveTab("review");
      return;
    }

    const currentCode = (userCode[selectedLanguage] || "").trim();
    if (!currentCode) {
      setAiReviewError("Please write some code before requesting an AI review.");
      setActiveTab("review");
      return;
    }

    // Invalidate prior review requests
    const currentToken = reviewTokenRef.current + 1;
    reviewTokenRef.current = currentToken;

    setIsReviewing(true);
    setAiReviewError("");
    setActiveTab("review");

    // Start 5-second client-side cooldown
    setReviewCooldown(5);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setReviewCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownTimerRef.current);
          cooldownTimerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    const codeSnapshot = userCode[selectedLanguage] || "";
    const problemIdSnapshot = problem._id;
    const languageSnapshot = selectedLanguage;
    const executionSummarySnapshot = lastExecutionSummary || undefined;

    try {
      const response = await fetch(`${API_BASE_URL}/api/submissions/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
          lastExecutionResult: executionSummarySnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      if (reviewTokenRef.current !== currentToken) {
        return;
      }

      if (response.ok && data?.review) {
        setAiReview(data.review);
        setAiReviewError("");
        const problemKey = problem?.slug || problem?._id || slug;
        if (problemKey) {
          try {
            localStorage.setItem(`codesync:ai_review_${problemKey}_${selectedLanguage}`, JSON.stringify(data.review));
            localStorage.setItem(`codesync:ai_review_${problemKey}`, JSON.stringify(data.review));
          } catch {
            // Ignore quota errors
          }
        }
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          (response.status === 429
            ? "AI review rate limit reached. Please wait a minute before requesting another review."
            : response.status === 503
            ? "AI review is currently unavailable."
            : response.status === 504
            ? "AI review timed out. Please try again with a smaller code sample."
            : response.status === 502
            ? "AI review could not be completed. Please retry."
            : response.status === 401
            ? "Authentication required. Please log in again."
            : response.status === 400
            ? "Validation error in review request."
            : "AI review service error. Please try again.");
        setAiReviewError(errorMsg);
      }
    } catch {
      if (reviewTokenRef.current === currentToken) {
        setAiReviewError("Could not connect to the AI review service. Please check your connection and try again.");
      }
    } finally {
      if (reviewTokenRef.current === currentToken) {
        setIsReviewing(false);
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
            aria-label="Back to Problems"
            title="Back to Problems"
          >
            ← Problems
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
              Description
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
              Submissions
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "review"}
              className={`workspace-tab-btn ${
                activeTab === "review" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("review")}
            >
              AI Review
              {aiReview && !isReviewing && !aiReviewError && (
                <span className="workspace-tab-dot" aria-label="Review available" />
              )}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "hint"}
              className={`workspace-tab-btn ${
                activeTab === "hint" ? "is-active" : ""
              }`}
              onClick={() => setActiveTab("hint")}
            >
              AI Hint
              {aiHint && !isHintLoading && !aiHintError && (
                <span className="workspace-tab-dot" aria-label="Hint available" />
              )}
            </button>
          </div>
        </div>

        {activeTab === "submissions" ? (
          <SubmissionsView
            problemId={problem._id}
            currentLanguage={selectedLanguage}
            refreshTrigger={submissionHistoryVersion}
          />
        ) : activeTab === "review" ? (
          <AIReviewPanel
            review={aiReview}
            loading={isReviewing}
            error={aiReviewError}
            onClose={() => setActiveTab("description")}
            onRequestReview={handleReviewCode}
          />
        ) : activeTab === "hint" ? (
          <AIHintPanel
            hint={aiHint}
            loading={isHintLoading}
            error={aiHintError}
            onClose={() => setActiveTab("description")}
            onRequestHint={handleGetHint}
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

            <div className="problem-identifier-footer">
              <span className="problem-id-label">Problem ID</span>
              <span className="problem-id-value">
                {problem.slug ? problem.slug.toUpperCase() : "CHALLENGE"}
              </span>
            </div>
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
              className={`btn btn-features ${showFeatures ? "is-active" : ""}`}
              onClick={() => setShowFeatures((prev) => !prev)}
              aria-expanded={showFeatures}
              aria-label="Toggle editor features and settings"
              title="Toggle editor features (Themes, Font size, Word wrap, Format, etc.)"
            >
              ⚡ Features {showFeatures ? "▲" : "▼"}
            </button>
            <button
              type="button"
              className="btn btn-save"
              onClick={handleSaveCode}
              aria-label="Save code draft locally (Ctrl+S)"
              title="Save current draft locally (Ctrl+S)"
            >
              {saveFeedback ? "Saved ✓" : "Save"}
            </button>
            <button
              type="button"
              className="btn btn-hint"
              onClick={handleGetHint}
              disabled={isHintLoading || hintCooldown > 0}
              aria-label="Get Socratic AI Hint"
              title={
                hintCooldown > 0
                  ? `Cooldown (${hintCooldown}s)`
                  : "Get Socratic algorithmic guidance"
              }
            >
              {isHintLoading
                ? "Getting Hint…"
                : hintCooldown > 0
                ? `Hint (${hintCooldown}s)`
                : "Get Hint"}
            </button>
            <button
              type="button"
              className="btn btn-review"
              onClick={handleReviewCode}
              disabled={isReviewing || reviewCooldown > 0}
              aria-label="Review Code with AI"
              title={
                reviewCooldown > 0
                  ? `Cooldown (${reviewCooldown}s)`
                  : "Request static AI code review"
              }
            >
              {isReviewing
                ? "Reviewing…"
                : reviewCooldown > 0
                ? `Review (${reviewCooldown}s)`
                : "Review Code"}
            </button>
            <button
              type="button"
              className="btn btn-run"
              onClick={handleRunCode}
              disabled={isRunning || isSubmitting}
              aria-label="Run code on visible test cases (Ctrl+Enter)"
              title="Run code on visible test cases (Ctrl+Enter)"
            >
              {isRunning ? "Running…" : "Run Code"}
            </button>
            <button
              type="button"
              className="btn btn-submit"
              onClick={handleSubmit}
              disabled={isRunning || isSubmitting}
              aria-label="Submit solution (Ctrl+Shift+Enter)"
              title="Submit solution (Ctrl+Shift+Enter)"
            >
              {isSubmitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>

        <div className="editor-container">
          <MonacoCodeEditor
            value={userCode[selectedLanguage] || ""}
            onChange={handleCodeChange}
            language={selectedLanguage}
            onRunCode={handleRunCode}
            onSubmitCode={handleSubmit}
            onSave={handleSaveCode}
            onReset={handleResetCode}
            showLangBadge={false}
            placeholder={`Write your ${selectedLanguage.toUpperCase()} solution here...`}
            showToolbar={showFeatures}
          />
        </div>

        {/* ================= RESIZABLE PANELS ================= */}
        {/* Horizontal drag handle between editor and output panels (visible only when expanded). */}
        {!isOutputCollapsed && (
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
        )}

        <OutputTerminal
          className="output-panel"
          output={output}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          statusSummary={lastExecutionSummary}
          onClear={() => setOutput("Run your code to see the output.")}
          isCollapsed={isOutputCollapsed}
          onToggleCollapse={() => setIsOutputCollapsed((prev) => !prev)}
        />
      </section>
    </div>
  );
}

export default ProblemWorkspace;