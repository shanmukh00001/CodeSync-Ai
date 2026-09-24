import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext.jsx";
import { API_BASE_URL } from "../config/api";
import RoomHeader from "../components/room/RoomHeader";
import RoomProblemPanel from "../components/room/RoomProblemPanel";
import RoomEditorPanel from "../components/room/RoomEditorPanel";
import RoomCollabBar from "../components/room/RoomCollabBar";
import RoomDiscussionDrawer from "../components/room/RoomDiscussionDrawer";
import { useRoomLayout, useDrag } from "../components/room/useRoomLayout";
import { useRoomSocket } from "../components/room/useRoomSocket";
import {
  formatExecutionResult,
  formatSubmissionResult,
  formatLanguage,
} from "../components/room/formatters";
import "./Dashboard.css";
import "./Room.css";

const MIN_PROBLEM = 240;
const MIN_EDITOR = 320;
const MIN_OUTPUT = 100;
const MIN_EDITOR_HEIGHT = 160;
const MIN_DISCUSSION_WIDTH = 340;
const MAX_DISCUSSION_WIDTH = 750;

function Room() {
  const params = useParams();
  const navigate = useNavigate();
  const routeRoomId = params.roomId;
  const { user } = useContext(AuthContext);

  // ================= ROOM DATA =================
  const [room, setRoom] = useState(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [roomError, setRoomError] = useState("");

  // ================= PROBLEMS =================
  const [problems, setProblems] = useState([]);
  const [problemsLoading, setProblemsLoading] = useState(true);
  const [problemsError, setProblemsError] = useState("");
  const [search, setSearch] = useState("");
  const [difficulty, setDifficulty] = useState("All");
  const [activeProblem, setActiveProblem] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectingProblem, setSelectingProblem] = useState(false);
  const [problemSelectError, setProblemSelectError] = useState("");

  // ================= CODE =================
  const [code, setCode] = useState("");
  const [codeSavedAt, setCodeSavedAt] = useState(null);
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);

  // ================= OUTPUT & EXECUTION =================
  const [output, setOutput] = useState("Run your code to see the output.");
  const [outputCollapsed, setOutputCollapsed] = useState(false);
  const [lastExecutionStatus, setLastExecutionStatus] = useState(null);
  const [lastExecutionSummary, setLastExecutionSummary] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionHistoryVersion, setSubmissionHistoryVersion] = useState(0);
  const executionTokenRef = useRef(0);

  // ================= AI REVIEW & HINT =================
  const [aiReview, setAiReview] = useState(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [aiReviewError, setAiReviewError] = useState("");
  const [reviewCooldown, setReviewCooldown] = useState(0);
  const reviewTokenRef = useRef(0);
  const cooldownTimerRef = useRef(null);

  const [aiHint, setAiHint] = useState(null);
  const [isHintLoading, setIsHintLoading] = useState(false);
  const [aiHintError, setAiHintError] = useState("");
  const [hintCooldown, setHintCooldown] = useState(0);
  const hintTokenRef = useRef(0);
  const hintCooldownTimerRef = useRef(null);

  // ================= LEAVE / END =================
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  // ================= TABS & COLLAB UI =================
  const [leftPanelTab, setLeftPanelTab] = useState("problem");
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [discussionOpen, setDiscussionOpen] = useState(false);
  const [hasUnreadDiscussion, setHasUnreadDiscussion] = useState(false);
  const [discussionWidth, setDiscussionWidth] = useState(480);
  const [linkCopied, setLinkCopied] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState([]);

  // ================= DISCUSSION MESSAGES =================
  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionInput, setDiscussionInput] = useState("");
  const [discussionSending, setDiscussionSending] = useState(false);

  // ================= LAYOUT =================
  const [layout, setLayout] = useRoomLayout();
  const containerRef = useRef(null);
  const codeSaveTimerRef = useRef(null);
  const lastSavedCodeRef = useRef("");
  const lastSelectedProblemIdRef = useRef(null);
  const isApplyingRemoteCodeRef = useRef(false);
  const codeDirtyRef = useRef(false);
  const latestCodeRef = useRef("");

  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);

  /* Fetch Room */
  const fetchRoom = useCallback(
    async (isPolling = false) => {
      if (!isPolling) {
        setRoomLoading(true);
        setRoomError("");
      }

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rooms/${routeRoomId}`,
          { credentials: "include" }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          if (!isPolling) {
            throw new Error(
              data?.error?.message ||
                data?.message ||
                "Failed to load room"
            );
          }
          return;
        }

        const fetched = data.room;
        setRoom((prev) => {
          if (!prev) return fetched;
          return { ...prev, ...fetched };
        });

        const newProblemId = fetched?.selectedProblem?._id
          ? String(fetched.selectedProblem._id)
          : fetched?.selectedProblem
          ? String(fetched.selectedProblem)
          : null;

        const problemChanged =
          lastSelectedProblemIdRef.current !== null &&
          lastSelectedProblemIdRef.current !== newProblemId;

        const isInitial = !isPolling || lastSelectedProblemIdRef.current === null;
        lastSelectedProblemIdRef.current = newProblemId;

        if (problemChanged) {
          executionTokenRef.current += 1;
          setIsRunning(false);
          setIsSubmitting(false);
        }

        if (fetched?.selectedProblem) {
          setActiveProblem(fetched.selectedProblem);
        } else {
          setActiveProblem(null);
        }

        if (isInitial || problemChanged) {
          let initialCode =
            typeof fetched?.code === "string" ? fetched.code : "";
          if (!initialCode && fetched?.selectedProblem?.starterCode) {
            const lang = fetched.language || "cpp";
            if (typeof fetched.selectedProblem.starterCode === "object") {
              initialCode = fetched.selectedProblem.starterCode[lang] || "";
            } else if (
              typeof fetched.selectedProblem.starterCode === "string" &&
              lang === "javascript"
            ) {
              initialCode = fetched.selectedProblem.starterCode;
            }
          }
          isApplyingRemoteCodeRef.current = true;
          setCode(initialCode);
          lastSavedCodeRef.current = initialCode;
          setCodeDirty(false);
          codeDirtyRef.current = false;
          setCodeSavedAt(null);
        }
      } catch (err) {
        if (!isPolling) {
          setRoomError(err.message);
        }
      } finally {
        if (!isPolling) {
          setRoomLoading(false);
        }
      }
    },
    [routeRoomId]
  );

  /* Fetch Problems */
  const fetchProblems = useCallback(async () => {
    setProblemsLoading(true);
    setProblemsError("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/problems`);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to fetch problems"
        );
      }

      setProblems(data.problems || []);
    } catch (err) {
      setProblemsError(err.message);
    } finally {
      setProblemsLoading(false);
    }
  }, []);

  /* Fetch Discussions */
  const fetchDiscussions = useCallback(async () => {
    if (!routeRoomId) return;
    setDiscussionLoading(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/discussions/${routeRoomId}`,
        { credentials: "include" }
      );
      const data = await response.json().catch(() => null);
      if (response.ok && Array.isArray(data?.messages)) {
        setDiscussionMessages(data.messages);
      }
    } catch {
      // ignore network errors
    } finally {
      setDiscussionLoading(false);
    }
  }, [routeRoomId]);

  useEffect(() => {
    fetchRoom(false);
    fetchProblems();
    fetchDiscussions();
  }, [fetchRoom, fetchProblems, fetchDiscussions]);

  /* Socket.IO Real-time Synchronization */
  const { emitCodeUpdate, emitCursorUpdate, emitDiscussionSend } = useRoomSocket({
    roomId: routeRoomId,
    user,
    onParticipantJoined: (payload) => {
      setRoom((prev) => (prev ? { ...prev, users: payload.users || prev.users } : prev));
    },
    onParticipantLeft: (payload) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              users: payload.users || prev.users,
              createdBy: payload.newCreatedBy || prev.createdBy,
            }
          : prev
      );
    },
    onRoomClosed: (payload) => {
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              status: "CLOSED",
              endedAt: payload.endedAt || new Date(),
            }
          : prev
      );
    },
    onCodeUpdate: (payload) => {
      if (codeSaveTimerRef.current) {
        clearTimeout(codeSaveTimerRef.current);
        codeSaveTimerRef.current = null;
      }
      setCodeSaving(false);
      isApplyingRemoteCodeRef.current = true;
      setCode(payload.code);
    },
    onCursorUpdate: (payload) => {
      if (!payload || !payload.position) return;
      const peerId = payload.senderId || payload.user?.id || "peer";
      const peerName = payload.user?.name || "Peer";
      const peerColor = payload.user?.color || "#388bfd";
      setRemoteCursors((prev) => {
        const filtered = prev.filter((rc) => rc.id !== peerId);
        return [
          ...filtered,
          {
            id: peerId,
            name: peerName,
            color: peerColor,
            position: payload.position,
          },
        ];
      });
    },
    onDiscussionMessage: (payload) => {
      // If discussion drawer is closed, trigger unread indicator
      if (!discussionOpen) {
        setHasUnreadDiscussion(true);
      }
      setDiscussionMessages((prev) => {
        // If message has clientMessageId matching an existing (optimistic) item, replace it
        if (payload.message?.clientMessageId) {
          const index = prev.findIndex(
            (m) =>
              m.clientMessageId &&
              String(m.clientMessageId) === String(payload.message.clientMessageId)
          );
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = payload.message;
            return updated;
          }
        }

        const exists = prev.some((m) => {
          if (
            m._id &&
            payload.message._id &&
            String(m._id) === String(payload.message._id)
          ) {
            return true;
          }
          return false;
        });
        if (exists) return prev;
        return [...prev, payload.message];
      });
    },
    onProblemChanged: (payload) => {
      const newProblem = payload.selectedProblem;
      const newProblemId = newProblem?._id
        ? String(newProblem._id)
        : newProblem
        ? String(newProblem)
        : null;

      const problemChanged = lastSelectedProblemIdRef.current !== newProblemId;
      lastSelectedProblemIdRef.current = newProblemId;

      if (problemChanged) {
        executionTokenRef.current += 1;
        reviewTokenRef.current += 1;
        hintTokenRef.current += 1;
        setIsRunning(false);
        setIsSubmitting(false);
        setIsReviewing(false);
        setIsHintLoading(false);
        setAiReview(null);
        setAiReviewError("");
        setAiHint(null);
        setAiHintError("");
        setLeftPanelTab("problem");
      }

      setActiveProblem(newProblem);
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          selectedProblem: newProblem,
          code: typeof payload.code === "string" ? payload.code : prev.code,
        };
      });

      if (problemChanged && typeof payload.code === "string") {
        isApplyingRemoteCodeRef.current = true;
        setCode(payload.code);
        lastSavedCodeRef.current = payload.code;
        setCodeDirty(false);
        codeDirtyRef.current = false;
        setCodeSavedAt(null);
      }
    },
    onReconnect: async () => {
      if (!codeDirtyRef.current) {
        try {
          const response = await fetch(
            `${API_BASE_URL}/api/rooms/${routeRoomId}`,
            { credentials: "include" }
          );
          const data = await response.json().catch(() => null);
          if (response.ok && data?.room && typeof data.room.code === "string") {
            if (!codeDirtyRef.current) {
              isApplyingRemoteCodeRef.current = true;
              setCode(data.room.code);
              lastSavedCodeRef.current = data.room.code;
              setCodeDirty(false);
              codeDirtyRef.current = false;
            }
          }
        } catch {
          // ignore
        }
      }
      fetchDiscussions();
    },
  });

  /* Auto-save code (debounced 800ms) */
  useEffect(() => {
    if (!room || roomLoading) return;

    if (isApplyingRemoteCodeRef.current) {
      isApplyingRemoteCodeRef.current = false;
      return;
    }

    if (code === lastSavedCodeRef.current) return;

    setCodeDirty(true);
    codeDirtyRef.current = true;

    if (codeSaveTimerRef.current) {
      clearTimeout(codeSaveTimerRef.current);
    }

    codeSaveTimerRef.current = setTimeout(async () => {
      const snapshot = code;
      setCodeSaving(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/rooms/${room.roomId}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ code: snapshot }),
          }
        );

        if (response.ok) {
          lastSavedCodeRef.current = snapshot;
          setCodeSavedAt(new Date());
          setCodeDirty(false);
          codeDirtyRef.current = false;
        }
      } catch {
        // Retry on next edit
      } finally {
        setCodeSaving(false);
      }
    }, 800);

    return () => {
      if (codeSaveTimerRef.current) {
        clearTimeout(codeSaveTimerRef.current);
      }
    };
  }, [code, room, roomLoading]);

  /* Best-effort save on unmount via Beacon */
  useEffect(() => {
    const roomIdForCleanup = routeRoomId;
    return () => {
      const currentCode = latestCodeRef.current;
      const lastSaved = lastSavedCodeRef.current;
      if (
        currentCode !== undefined &&
        currentCode !== lastSaved &&
        roomIdForCleanup &&
        navigator.sendBeacon
      ) {
        try {
          navigator.sendBeacon(
            `${API_BASE_URL}/api/rooms/${roomIdForCleanup}`,
            new Blob([JSON.stringify({ code: currentCode })], {
              type: "application/json",
            })
          );
        } catch {
          // ignore
        }
      }
    };
  }, [routeRoomId]);

  // Reset link copied feedback
  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  // Cooldown timers cleanup
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      if (hintCooldownTimerRef.current) clearInterval(hintCooldownTimerRef.current);
    };
  }, []);

  /* Local Code Change Handler */
  const handleEditorCodeChange = useCallback((newCode) => {
    isApplyingRemoteCodeRef.current = false;
    setCode(newCode);
    emitCodeUpdate(newCode);
  }, [emitCodeUpdate]);

  /* Manual Save */
  const handleSaveCode = useCallback(async () => {
    if (!room || roomLoading) return;
    if (codeSaveTimerRef.current) {
      clearTimeout(codeSaveTimerRef.current);
      codeSaveTimerRef.current = null;
    }

    setCodeSaving(true);
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${room.roomId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ code }),
        }
      );
      if (response.ok) {
        lastSavedCodeRef.current = code;
        setCodeSavedAt(new Date());
        setCodeDirty(false);
        codeDirtyRef.current = false;
      }
    } catch {
      // Retry on next auto-save
    } finally {
      setCodeSaving(false);
    }
  }, [room, roomLoading, code]);

  /* Reset Code to Starter Template */
  const handleResetCode = useCallback(() => {
    if (room?.status === "CLOSED") return;
    const lang = room?.language || "cpp";
    if (
      window.confirm(
        `Reset ${formatLanguage(
          lang
        )} code to default starter template? Current edits will be replaced.`
      )
    ) {
      let defaultCode = "";
      if (activeProblem?.starterCode) {
        if (typeof activeProblem.starterCode === "object") {
          defaultCode = activeProblem.starterCode[lang] || "";
        } else if (
          typeof activeProblem.starterCode === "string" &&
          lang === "javascript"
        ) {
          defaultCode = activeProblem.starterCode;
        }
      }
      handleEditorCodeChange(defaultCode);
    }
  }, [room?.status, room?.language, activeProblem, handleEditorCodeChange]);

  /* Copy Room Link */
  const handleCopyLink = useCallback(async () => {
    if (!routeRoomId) return;
    const url = `${window.location.origin}/room/${routeRoomId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement("textarea");
        input.value = url;
        input.setAttribute("readonly", "");
        input.style.position = "absolute";
        input.style.left = "-9999px";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        document.body.removeChild(input);
      }
      setLinkCopied(true);
    } catch {
      // ignore
    }
  }, [routeRoomId]);

  /* Leave Room */
  const handleLeaveRoom = async () => {
    if (leaving) return;
    setLeaving(true);
    setLeaveError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${routeRoomId}/leave`,
        { method: "POST", credentials: "include" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "Failed to leave room"
        );
      }
      navigate("/dashboard");
    } catch (err) {
      setLeaveError(err.message);
      setLeaving(false);
    }
  };

  /* End Room (Host only) */
  const handleEndRoom = async () => {
    if (ending || !room) return;
    const confirmed = window.confirm(
      "End this room? Participants will no longer be able to join or continue the discussion."
    );
    if (!confirmed) return;

    setEnding(true);
    setEndError("");
    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${routeRoomId}/end`,
        { method: "POST", credentials: "include" }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "Failed to end room"
        );
      }
      setRoom((prev) =>
        prev
          ? {
              ...prev,
              status: "CLOSED",
              endedAt: data?.room?.endedAt || new Date(),
            }
          : prev
      );
    } catch (err) {
      setEndError(err.message);
    } finally {
      setEnding(false);
    }
  };

  /* Problem Selection (Host only) */
  const handleSelectProblem = async (problem) => {
    if (!room) return;
    setProblemSelectError("");
    setSelectingProblem(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/rooms/${room.roomId}/problem`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ problemId: problem._id }),
        }
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          data?.error?.message || data?.message || "Failed to select problem"
        );
      }

      const updatedRoom = data?.room;
      const updatedProblem = updatedRoom?.selectedProblem || problem;
      const newProblemId = updatedProblem?._id
        ? String(updatedProblem._id)
        : String(updatedProblem);
      lastSelectedProblemIdRef.current = newProblemId;

      executionTokenRef.current += 1;
      reviewTokenRef.current += 1;
      hintTokenRef.current += 1;
      setIsRunning(false);
      setIsSubmitting(false);
      setIsReviewing(false);
      setIsHintLoading(false);
      setAiReview(null);
      setAiReviewError("");
      setAiHint(null);
      setAiHintError("");
      setLeftPanelTab("problem");

      setActiveProblem(updatedProblem);
      setRoom(
        updatedRoom ||
          ((prev) => ({
            ...prev,
            selectedProblem: updatedProblem,
            code:
              typeof updatedRoom?.code === "string"
                ? updatedRoom.code
                : prev.code,
          }))
      );

      let newCode =
        typeof updatedRoom?.code === "string" ? updatedRoom.code : "";
      if (!newCode && updatedProblem?.starterCode) {
        const lang = room?.language || "cpp";
        if (typeof updatedProblem.starterCode === "object") {
          newCode = updatedProblem.starterCode[lang] || "";
        } else if (
          typeof updatedProblem.starterCode === "string" &&
          lang === "javascript"
        ) {
          newCode = updatedProblem.starterCode;
        }
      }
      isApplyingRemoteCodeRef.current = true;
      setCode(newCode);
      lastSavedCodeRef.current = newCode;
      setCodeDirty(false);
      codeDirtyRef.current = false;
    } catch (err) {
      setProblemSelectError(err.message);
    } finally {
      setSelectingProblem(false);
    }
  };

  /* Run Code Handler */
  const handleRunCode = async () => {
    if (isRunning || isSubmitting) return;

    if (!activeProblem?._id) {
      setOutput("Please select a problem first before running code.");
      setOutputCollapsed(false);
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsRunning(true);
    setOutputCollapsed(false);
    setOutput("Running code on visible test cases…");

    try {
      const response = await fetch(`${API_BASE_URL}/api/submissions/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: activeProblem._id,
          language: room?.language || "cpp",
          code: code || "",
          roomId: room?.roomId || null,
        }),
      });

      const data = await response.json().catch(() => null);

      if (executionTokenRef.current !== currentToken) return;

      if (response.ok && data?.result) {
        setOutput(formatExecutionResult(data.result));
        setOutputCollapsed(false);
        const res = data.result;
        setLastExecutionSummary({
          status:
            res.status === "accepted"
              ? "Accepted"
              : res.status === "wrong_answer"
              ? "Wrong Answer"
              : res.status === "compilation_error"
              ? "Compilation Error"
              : res.status === "runtime_error"
              ? "Runtime Error"
              : res.status === "time_limit_exceeded"
              ? "Time Limit Exceeded"
              : "Error",
          passedTestCases:
            typeof res.passedTestCases === "number" ? res.passedTestCases : 0,
          totalTestCases:
            typeof res.totalTestCases === "number" ? res.totalTestCases : 0,
          runtimeMs:
            typeof res.runtimeMs === "number" ? res.runtimeMs : undefined,
          memoryKb: typeof res.memoryKb === "number" ? res.memoryKb : undefined,
        });
        const statusLabel =
          data.result.status === "accepted"
            ? "Accepted"
            : data.result.status === "wrong_answer"
            ? "Wrong Answer"
            : data.result.status === "compilation_error"
            ? "Compilation Error"
            : data.result.status === "runtime_error"
            ? "Runtime Error"
            : data.result.status === "time_limit_exceeded"
            ? "Time Limit Exceeded"
            : "Error";
        const metaStr = [
          statusLabel,
          typeof data.result.runtimeMs === "number"
            ? `${data.result.runtimeMs} ms`
            : null,
          typeof data.result.memoryKb === "number"
            ? `${data.result.memoryKb} KB`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setLastExecutionStatus({
          label: statusLabel,
          meta: metaStr,
          isSuccess: data.result.status === "accepted",
        });
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "Execution engine error. Please try again.";
        setOutput(`✗ Execution Failed\n\n${errorMsg}`);
        setOutputCollapsed(false);
        setLastExecutionStatus({
          label: "Failed",
          meta: "Execution Failed",
          isSuccess: false,
        });
      }
    } catch {
      if (executionTokenRef.current === currentToken) {
        setOutput(
          "✗ Network Error\n\nCould not connect to the execution server. Please check your connection and try again."
        );
        setOutputCollapsed(false);
        setLastExecutionStatus({
          label: "Network Error",
          meta: "Connection Failed",
          isSuccess: false,
        });
      }
    } finally {
      if (executionTokenRef.current === currentToken) {
        setIsRunning(false);
      }
    }
  };

  /* Submit Code Handler */
  const handleSubmitCode = async () => {
    if (isRunning || isSubmitting) return;

    if (!activeProblem?._id) {
      setOutput("Please select a problem first before submitting.");
      setOutputCollapsed(false);
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsSubmitting(true);
    setOutputCollapsed(false);
    setOutput("Submitting code to full evaluation pipeline…");

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/submissions/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            problemId: activeProblem._id,
            language: room?.language || "cpp",
            code: code || "",
            roomId: room?.roomId || null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (executionTokenRef.current !== currentToken) return;

      if (response.ok && data?.submission) {
        setOutput(formatSubmissionResult(data.submission));
        setOutputCollapsed(false);
        setSubmissionHistoryVersion((v) => v + 1);
        const sub = data.submission;
        setLastExecutionSummary({
          status: sub.status || "Unknown",
          passedTestCases:
            typeof sub.passedTestCases === "number" ? sub.passedTestCases : 0,
          totalTestCases:
            typeof sub.totalTestCases === "number" ? sub.totalTestCases : 0,
          runtimeMs:
            typeof sub.runtimeMs === "number" ? sub.runtimeMs : undefined,
          memoryKb: typeof sub.memoryKb === "number" ? sub.memoryKb : undefined,
        });
        const statusLabel = data.submission.status || "Submitted";
        const metaStr = [
          statusLabel,
          typeof data.submission.runtimeMs === "number" &&
          data.submission.runtimeMs > 0
            ? `${data.submission.runtimeMs} ms`
            : null,
          typeof data.submission.memoryKb === "number" &&
          data.submission.memoryKb > 0
            ? `${data.submission.memoryKb} KB`
            : null,
          typeof data.submission.passedTestCases === "number" &&
          typeof data.submission.totalTestCases === "number"
            ? `${data.submission.passedTestCases}/${data.submission.totalTestCases} tests`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setLastExecutionStatus({
          label: statusLabel,
          meta: metaStr,
          isSuccess: data.submission.status === "Accepted",
        });
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "Submission evaluation error. Please try again.";
        setOutput(`✗ Submission Failed\n\n${errorMsg}`);
        setOutputCollapsed(false);
        setLastExecutionStatus({
          label: "Failed",
          meta: "Submission Failed",
          isSuccess: false,
        });
      }
    } catch {
      if (executionTokenRef.current === currentToken) {
        setOutput(
          "✗ Network Error\n\nCould not connect to the submission server. Please check your connection and try again."
        );
        setOutputCollapsed(false);
        setLastExecutionStatus({
          label: "Network Error",
          meta: "Connection Failed",
          isSuccess: false,
        });
      }
    } finally {
      if (executionTokenRef.current === currentToken) {
        setIsSubmitting(false);
      }
    }
  };

  /* AI Hint Handler */
  const handleGetHint = async () => {
    if (isHintLoading || hintCooldown > 0 || room?.status === "CLOSED") return;

    if (!activeProblem?._id) {
      setAiHintError("Please select a problem first before requesting an AI hint.");
      setLeftPanelTab("hint");
      return;
    }

    const currentToken = hintTokenRef.current + 1;
    hintTokenRef.current = currentToken;

    setIsHintLoading(true);
    setAiHintError("");
    setLeftPanelTab("hint");

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

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/submissions/hint`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            problemId: activeProblem._id,
            language: room?.language || "cpp",
            code: code || "",
            roomId: room?.roomId || routeRoomId || undefined,
            lastExecutionResult: lastExecutionSummary || undefined,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (hintTokenRef.current !== currentToken) return;

      if (response.ok && data?.hint) {
        setAiHint(data.hint);
        setAiHintError("");
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "AI hint service error. Please try again.";
        setAiHintError(errorMsg);
      }
    } catch {
      if (hintTokenRef.current === currentToken) {
        setAiHintError(
          "Could not connect to the AI hint service. Please check your connection and try again."
        );
      }
    } finally {
      if (hintTokenRef.current === currentToken) {
        setIsHintLoading(false);
      }
    }
  };

  /* AI Review Handler */
  const handleReviewCode = async () => {
    if (isReviewing || reviewCooldown > 0 || room?.status === "CLOSED") return;

    if (!activeProblem?._id) {
      setAiReviewError("Please select a problem first before requesting an AI review.");
      setLeftPanelTab("review");
      return;
    }

    const currentCode = (code || "").trim();
    if (!currentCode) {
      setAiReviewError("Please write some code before requesting an AI review.");
      setLeftPanelTab("review");
      return;
    }

    const currentToken = reviewTokenRef.current + 1;
    reviewTokenRef.current = currentToken;

    setIsReviewing(true);
    setAiReviewError("");
    setLeftPanelTab("review");

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

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/submissions/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            problemId: activeProblem._id,
            language: room?.language || "cpp",
            code: code || "",
            roomId: room?.roomId || routeRoomId || undefined,
            lastExecutionResult: lastExecutionSummary || undefined,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (reviewTokenRef.current !== currentToken) return;

      if (response.ok && data?.review) {
        setAiReview(data.review);
        setAiReviewError("");
      } else {
        const errorMsg =
          data?.error?.message ||
          data?.message ||
          "AI review service error. Please try again.";
        setAiReviewError(errorMsg);
      }
    } catch {
      if (reviewTokenRef.current === currentToken) {
        setAiReviewError(
          "Could not connect to the AI review service. Please check your connection and try again."
        );
      }
    } finally {
      if (reviewTokenRef.current === currentToken) {
        setIsReviewing(false);
      }
    }
  };

  /* Send Discussion Message */
  const handleSendDiscussionMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!discussionInput || !discussionInput.trim() || discussionSending) return;

    const trimmed = discussionInput.trim();
    setDiscussionSending(true);

    const clientMessageId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${currentUserId || "user"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    // Optimistically create local message so sender sees it immediately
    const optimisticMsg = {
      _id: `temp-${Date.now()}`,
      clientMessageId,
      message: trimmed,
      user: {
        _id: currentUserId,
        id: currentUserId,
        name: user?.name || "You",
        email: user?.email,
      },
      createdAt: new Date().toISOString(),
    };

    setDiscussionMessages((prev) => [...prev, optimisticMsg]);
    setDiscussionInput("");

    const sentViaSocket = emitDiscussionSend(
      {
        roomId: routeRoomId,
        message: trimmed,
        clientMessageId,
      },
      (response) => {
        setDiscussionSending(false);
        if (!response?.success) {
          // If failed, remove the optimistic message
          setDiscussionMessages((prev) =>
            prev.filter((m) => m.clientMessageId !== clientMessageId)
          );
        }
      }
    );

    if (!sentViaSocket) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/discussions/${routeRoomId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ message: trimmed, clientMessageId }),
          }
        );
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          setDiscussionMessages((prev) =>
            prev.filter((m) => m.clientMessageId !== clientMessageId)
          );
        }
      } catch {
        setDiscussionMessages((prev) =>
          prev.filter((m) => m.clientMessageId !== clientMessageId)
        );
      } finally {
        setDiscussionSending(false);
      }
    } else {
      // Timeout fallback for sending state in case ack is delayed
      setTimeout(() => setDiscussionSending(false), 2000);
    }
  };

  /* Resizers */
  const problemWidthDrag = useDrag({
    axis: "x",
    onMove: (delta) => {
      setLayout((prev) => {
        const [problemW] = prev.horizontal;
        const containerWidth = containerRef.current?.clientWidth || 0;
        if (!containerWidth) return prev;
        const maxProblem = containerWidth - MIN_EDITOR - 8;
        const newProblem = Math.min(
          Math.max(problemW + delta, MIN_PROBLEM),
          Math.max(MIN_PROBLEM, maxProblem)
        );
        return { ...prev, horizontal: [newProblem] };
      });
    },
  });

  const outputHeightDrag = useDrag({
    axis: "y",
    onMove: (delta) => {
      setLayout((prev) => {
        const totalHeight = containerRef.current?.clientHeight || 0;
        if (!totalHeight) return prev;
        const maxOutputPercentage = Math.floor(totalHeight * 0.6);
        const maxOutputBounded = Math.max(
          MIN_OUTPUT,
          Math.min(maxOutputPercentage, totalHeight - MIN_EDITOR_HEIGHT)
        );
        const newOutputHeight = Math.min(
          Math.max(prev.outputHeight - delta, MIN_OUTPUT),
          maxOutputBounded
        );
        return { ...prev, outputHeight: newOutputHeight };
      });
    },
  });

  const discussionWidthDrag = useDrag({
    axis: "x",
    onMove: (delta) => {
      setDiscussionWidth((prev) =>
        Math.min(
          MAX_DISCUSSION_WIDTH,
          Math.max(MIN_DISCUSSION_WIDTH, prev - delta)
        )
      );
    },
  });

  /* Derived states */
  const currentUserId = user?.id || user?._id;
  const isCreator = Boolean(
    room &&
      currentUserId &&
      (room.createdBy?._id
        ? String(room.createdBy._id) === String(currentUserId)
        : String(room.createdBy) === String(currentUserId))
  );
  const isClosed = room?.status === "CLOSED";
  const participantsCount = Array.isArray(room?.users) ? room.users.length : 1;

  const lastSavedLabel = codeSaving
    ? "Saving…"
    : codeSavedAt
    ? `Saved ${codeSavedAt.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : codeDirty
    ? "Unsaved changes"
    : "All changes saved";

  if (roomLoading) {
    return (
      <div className="room-shell">
        <RoomHeader
          room={null}
          participantsCount={0}
          leaving={false}
          leaveError=""
          onLeave={() => {}}
          onBack={() => navigate("/dashboard")}
        />
        <div className="room-loading">
          <div className="loading-spinner" />
          <p>Loading room…</p>
        </div>
      </div>
    );
  }

  if (roomError) {
    return (
      <div className="room-shell">
        <RoomHeader
          room={null}
          participantsCount={0}
          leaving={false}
          leaveError=""
          onLeave={() => {}}
          onBack={() => navigate("/dashboard")}
        />
        <div className="room-error-state">
          <h2>Could not load room</h2>
          <p>{roomError}</p>
          <button
            type="button"
            className="room-primary-btn"
            onClick={() => navigate("/dashboard")}
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const [problemWidth] = layout.horizontal;

  return (
    <div className="room-shell">
      <RoomHeader
        room={room}
        participantsCount={participantsCount}
        leaving={leaving}
        leaveError={leaveError}
        onLeave={handleLeaveRoom}
        isHost={isCreator}
        isClosed={isClosed}
        ending={ending}
        endError={endError}
        onEnd={handleEndRoom}
        onBack={() => navigate("/dashboard")}
      />

      {isClosed && (
        <div className="room-closed-banner" role="status">
          <span className="room-closed-banner-tag">CLOSED</span>
          <span>
            This room has been ended by the host. Discussion and code execution
            are closed.
          </span>
        </div>
      )}

      <div className="room-workspace" ref={containerRef}>
        {/* Left Problem Panel */}
        <RoomProblemPanel
          problemWidth={problemWidth}
          leftPanelTab={leftPanelTab}
          onTabChange={setLeftPanelTab}
          isCreator={isCreator}
          activeProblem={activeProblem}
          room={room}
          submissionHistoryVersion={submissionHistoryVersion}
          aiReview={aiReview}
          isReviewing={isReviewing}
          aiReviewError={aiReviewError}
          aiHint={aiHint}
          isHintLoading={isHintLoading}
          aiHintError={aiHintError}
          problemSelectError={problemSelectError}
          pickerOpen={pickerOpen}
          onTogglePicker={() => !isClosed && setPickerOpen((prev) => !prev)}
          onClosePicker={() => setPickerOpen(false)}
          problems={problems}
          problemsLoading={problemsLoading}
          problemsError={problemsError}
          search={search}
          onSearchChange={setSearch}
          difficulty={difficulty}
          onDifficultyChange={setDifficulty}
          onSelectProblem={handleSelectProblem}
          selectingProblem={selectingProblem}
          isClosed={isClosed}
        />

        {/* Vertical Resizer Divider */}
        <div
          className="room-resizer room-resizer-vertical"
          onMouseDown={problemWidthDrag.handlePointerDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize problem panel"
          title="Drag to resize"
        >
          <span className="room-resizer-grip" aria-hidden="true" />
        </div>

        {/* Editor & Output Panel */}
        <RoomEditorPanel
          room={room}
          code={code}
          onCodeChange={handleEditorCodeChange}
          isClosed={isClosed}
          codeSaving={codeSaving}
          lastSavedLabel={lastSavedLabel}
          onSaveCode={handleSaveCode}
          isHintLoading={isHintLoading}
          hintCooldown={hintCooldown}
          onGetHint={handleGetHint}
          isReviewing={isReviewing}
          reviewCooldown={reviewCooldown}
          onReviewCode={handleReviewCode}
          isRunning={isRunning}
          isSubmitting={isSubmitting}
          onRunCode={handleRunCode}
          onSubmitCode={handleSubmitCode}
          onResetCode={handleResetCode}
          onCursorChange={emitCursorUpdate}
          remoteCursors={remoteCursors}
          outputHeight={layout.outputHeight}
          outputCollapsed={outputCollapsed}
          onToggleOutputCollapse={() => setOutputCollapsed((prev) => !prev)}
          outputHeightDrag={outputHeightDrag}
          output={output}
          lastExecutionStatus={lastExecutionStatus}
        />
      </div>

      {/* Bottom Collaboration Bar */}
      <RoomCollabBar
        linkCopied={linkCopied}
        onCopyLink={handleCopyLink}
        participantsOpen={participantsOpen}
        onToggleParticipants={() => setParticipantsOpen((v) => !v)}
        onCloseParticipants={() => setParticipantsOpen(false)}
        participantsCount={participantsCount}
        room={room}
        currentUserId={currentUserId}
        user={user}
        discussionOpen={discussionOpen}
        onToggleDiscussion={() => {
          setDiscussionOpen((v) => {
            const next = !v;
            if (next) setHasUnreadDiscussion(false);
            return next;
          });
        }}
        hasUnreadDiscussion={hasUnreadDiscussion}
      />

      {/* Technical Discussion Side Drawer */}
      <RoomDiscussionDrawer
        isOpen={discussionOpen}
        onClose={() => setDiscussionOpen(false)}
        discussionWidth={discussionWidth}
        discussionWidthDrag={discussionWidthDrag}
        discussionLoading={discussionLoading}
        discussionMessages={discussionMessages}
        discussionInput={discussionInput}
        onInputChange={setDiscussionInput}
        discussionSending={discussionSending}
        onSendMessage={handleSendDiscussionMessage}
        onPromptChipClick={(text) => setDiscussionInput(text)}
        currentUserId={currentUserId}
        isClosed={isClosed}
      />
    </div>
  );
}

export default Room;
