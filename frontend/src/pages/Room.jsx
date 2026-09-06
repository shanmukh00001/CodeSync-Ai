import { useState, useEffect, useRef, useCallback, useContext } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { AuthContext } from "../context/AuthContext.jsx";
import SubmissionsView from "../components/SubmissionsView";
import "./Dashboard.css";
import "./Room.css";

const LANGUAGE_LABELS = {
  cpp: "C++",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
};

const formatLanguage = (code) =>
  LANGUAGE_LABELS[code] || (code ? code.toUpperCase() : "—");

// Default layout sizes for the resizable sections. Persisted in
// localStorage so the user's preferred split is remembered between visits.
//
// Layout shape:
//   horizontal: [problemWidth]   — width of the LEFT problem panel.
//   outputHeight: number         — height of the output sub-panel (bottom of right column).
const DEFAULT_LAYOUT = {
  horizontal: [400],
  outputHeight: 220,
};

const LAYOUT_STORAGE_KEY = "codesync:roomLayout";

const loadLayout = () => {
  if (typeof window === "undefined") return DEFAULT_LAYOUT;
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);

    // Migrate from the previous 3-column shape (problem | editor | output)
    // by collapsing the legacy `horizontal[0]` into the new single-value shape.
    let horizontal = Array.isArray(parsed.horizontal) ? parsed.horizontal : [];
    if (horizontal.length >= 3) {
      horizontal = [horizontal[0]];
    } else if (horizontal.length === 0) {
      horizontal = DEFAULT_LAYOUT.horizontal;
    } else {
      horizontal = [horizontal[0]];
    }

    const outputHeight =
      typeof parsed.outputHeight === "number"
        ? parsed.outputHeight
        : DEFAULT_LAYOUT.outputHeight;

    return { horizontal, outputHeight };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

const saveLayout = (layout) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // ignore quota / privacy-mode errors
  }
};

function useResizableLayout() {
  const [layout, setLayout] = useState(loadLayout);

  const updateLayout = useCallback((updater) => {
    setLayout((prev) => {
      const next =
        typeof updater === "function" ? updater(prev) : updater;
      saveLayout(next);
      return next;
    });
  }, []);

  return [layout, updateLayout];
}

// Generic mouse-drag splitter. Pass axis = "x" for a vertical divider
// (drag horizontally) or axis = "y" for a horizontal divider (drag vertically).
function useDrag({ axis, onMove }) {
  const stateRef = useRef(null);

  const handlePointerDown = useCallback(
    (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      e.preventDefault();

      stateRef.current = {
        startCoord: axis === "x" ? e.clientX : e.clientY,
      };

      const handleMove = (ev) => {
        if (!stateRef.current) return;
        const coord = axis === "x" ? ev.clientX : ev.clientY;
        const delta = coord - stateRef.current.startCoord;
        stateRef.current.startCoord = coord;
        onMove(delta);
      };

      const handleUp = () => {
        stateRef.current = null;
        window.removeEventListener("mousemove", handleMove);
        window.removeEventListener("mouseup", handleUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      window.addEventListener("mousemove", handleMove);
      window.addEventListener("mouseup", handleUp);
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [axis, onMove]
  );

  return { handlePointerDown };
}

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

  // ================= PROBLEM PICKER POPUP (CREATOR ONLY) =================
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerButtonRef = useRef(null);
  const pickerPopupRef = useRef(null);
  const pickerSearchInputRef = useRef(null);

  // ================= CODE =================
  const [code, setCode] = useState("");
  const [codeSavedAt, setCodeSavedAt] = useState(null);
  const [codeSaving, setCodeSaving] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);

  // ================= OUTPUT & EXECUTION =================
  const [output, setOutput] = useState("Run your code to see the output.");
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionHistoryVersion, setSubmissionHistoryVersion] = useState(0);
  const executionTokenRef = useRef(0);

  // ================= LEAVE / END =================
  const [leaving, setLeaving] = useState(false);
  const [leaveError, setLeaveError] = useState("");
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState("");

  // ================= PROBLEM / SUBMISSIONS TAB =================
  const [leftPanelTab, setLeftPanelTab] = useState("problem");

  // ================= COLLAB BAR UI =================
  // Participants popup (anchored to the participants button).
  const [participantsOpen, setParticipantsOpen] = useState(false);
  // Discussion drawer open/closed.
  const [discussionOpen, setDiscussionOpen] = useState(false);
  // Discussion drawer width in pixels (also resizable horizontally).
  const [discussionWidth, setDiscussionWidth] = useState(480);
  // "Copied!" feedback after copying the room link.
  const [linkCopied, setLinkCopied] = useState(false);

  // ================= DISCUSSION MESSAGES =================
  const [discussionMessages, setDiscussionMessages] = useState([]);
  const [discussionLoading, setDiscussionLoading] = useState(false);
  const [discussionInput, setDiscussionInput] = useState("");
  const [discussionSending, setDiscussionSending] = useState(false);
  const discussionBodyRef = useRef(null);

  // ================= LAYOUT =================
  const [layout, setLayout] = useResizableLayout();

  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const codeSaveTimerRef = useRef(null);
  const lastSavedCodeRef = useRef("");
  const lastSelectedProblemIdRef = useRef(null);
  const socketRef = useRef(null);
  const isApplyingRemoteCodeRef = useRef(false);
  const codeDirtyRef = useRef(false);
  const lastReceivedUpdateTimestampRef = useRef(0);

  /* Fetch room */
  const fetchRoom = useCallback(async (isPolling = false) => {
    if (!isPolling) {
      setRoomLoading(true);
      setRoomError("");
    }

    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${routeRoomId}`,
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
        // Only update if room data or users or selectedProblem changed
        if (!prev) return fetched;
        return {
          ...prev,
          ...fetched,
        };
      });

      // Check whether selected problem changed
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

      // Invalidate pending execution tokens on problem change
      if (problemChanged) {
        executionTokenRef.current += 1;
        setIsRunning(false);
        setIsSubmitting(false);
      }

      // Update activeProblem
      if (fetched?.selectedProblem) {
        setActiveProblem(fetched.selectedProblem);
      } else {
        setActiveProblem(null);
      }

      // Initialize or update code state on initial load OR when problem changed
      if (isInitial || problemChanged) {
        const initialCode =
          typeof fetched?.code === "string" ? fetched.code : "";
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
  }, [routeRoomId]);

  /* Fetch problems */
  const fetchProblems = useCallback(async () => {
    setProblemsLoading(true);
    setProblemsError("");

    try {
      const response = await fetch("http://localhost:5000/api/problems");
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

  useEffect(() => {
    // Initial fetch on mount / route change
    fetchRoom(false);
    fetchProblems();
  }, [fetchRoom, fetchProblems]);

  /* Fetch discussion messages */
  const fetchDiscussions = useCallback(async () => {
    if (!routeRoomId) return;
    setDiscussionLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/discussions/${routeRoomId}`,
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
    fetchDiscussions();
  }, [fetchDiscussions]);

  /* Real-time Room Synchronization via Socket.IO */
  useEffect(() => {
    if (!routeRoomId) return;

    const socket = io("http://localhost:5000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", async () => {
      // Join the CodeSync room communication channel
      socket.emit("room:join", { roomId: routeRoomId });

      // Reconcile on reconnect / initial connect if local code is clean
      if (!codeDirtyRef.current) {
        try {
          const response = await fetch(
            `http://localhost:5000/api/rooms/${routeRoomId}`,
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
          // ignore network errors on reconnect reconciliation
        }
      }

      // Also reconcile discussion messages upon reconnect
      fetchDiscussions();
    });

    // Participant joined event
    socket.on("participant:joined", (payload) => {
      if (!payload || payload.roomId !== routeRoomId) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: payload.users || prev.users,
        };
      });
    });

    // Participant left event
    socket.on("participant:left", (payload) => {
      if (!payload || payload.roomId !== routeRoomId) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: payload.users || prev.users,
          createdBy: payload.newCreatedBy || prev.createdBy,
        };
      });
    });

    // Room closed event (explicit end by host)
    socket.on("room:closed", (payload) => {
      if (!payload || payload.roomId !== routeRoomId) return;
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: "CLOSED",
          endedAt: payload.endedAt || new Date(),
        };
      });
    });

    // Real-time collaborative code update event
    socket.on("code:update", (payload) => {
      if (!payload || payload.roomId !== routeRoomId) return;
      if (typeof payload.code !== "string") return;

      // Ignore echoes from self if senderId matches current user
      const myId = user?.id || user?._id;
      if (payload.senderId && myId && String(payload.senderId) === String(myId)) {
        return;
      }

      // Check timestamp to discard stale out-of-order packets
      if (payload.timestamp && payload.timestamp < lastReceivedUpdateTimestampRef.current) {
        return;
      }
      if (payload.timestamp) {
        lastReceivedUpdateTimestampRef.current = payload.timestamp;
      }

      // Invalidate any local pending debounce save so stale local text is not saved over newer remote text
      if (codeSaveTimerRef.current) {
        clearTimeout(codeSaveTimerRef.current);
        codeSaveTimerRef.current = null;
      }
      setCodeSaving(false);

      // Preserve textarea selection / caret
      const textarea = editorRef.current;
      const isFocused = document.activeElement === textarea;
      let selectionStart = 0;
      let selectionEnd = 0;
      if (textarea && isFocused) {
        selectionStart = textarea.selectionStart;
        selectionEnd = textarea.selectionEnd;
      }

      isApplyingRemoteCodeRef.current = true;
      setCode(payload.code);

      // Restore cursor position in next animation frame
      if (textarea && isFocused) {
        requestAnimationFrame(() => {
          if (document.activeElement === textarea) {
            const maxLen = payload.code.length;
            const newStart = Math.min(selectionStart, maxLen);
            const newEnd = Math.min(selectionEnd, maxLen);
            try {
              textarea.setSelectionRange(newStart, newEnd);
            } catch {
              // ignore selection range errors on unsupported environments
            }
          }
        });
      }
    });

    // Real-time discussion message event
    socket.on("discussion:message", (payload) => {
      if (!payload || payload.roomId !== routeRoomId || !payload.message) return;

      setDiscussionMessages((prev) => {
        // Prevent duplicate appending if message is already present by _id or clientMessageId
        const exists = prev.some((m) => {
          if (
            m._id &&
            payload.message._id &&
            String(m._id) === String(payload.message._id)
          ) {
            return true;
          }
          if (
            m.clientMessageId &&
            payload.message.clientMessageId &&
            String(m.clientMessageId) === String(payload.message.clientMessageId)
          ) {
            return true;
          }
          return false;
        });
        if (exists) return prev;
        return [...prev, payload.message];
      });

      // Smart auto-scroll if user was already near bottom
      const container = discussionBodyRef.current;
      if (container) {
        const isNearBottom =
          container.scrollHeight - container.scrollTop - container.clientHeight < 120;
        if (isNearBottom) {
          requestAnimationFrame(() => {
            if (discussionBodyRef.current) {
              discussionBodyRef.current.scrollTop =
                discussionBodyRef.current.scrollHeight;
            }
          });
        }
      }
    });

    // Selected problem changed event
    socket.on("problem:changed", (payload) => {
      if (!payload || payload.roomId !== routeRoomId) return;
      const newProblem = payload.selectedProblem;
      const newProblemId = newProblem?._id
        ? String(newProblem._id)
        : newProblem
        ? String(newProblem)
        : null;

      // Only update code/problem if problem genuinely changed
      const problemChanged = lastSelectedProblemIdRef.current !== newProblemId;
      lastSelectedProblemIdRef.current = newProblemId;

      if (problemChanged) {
        executionTokenRef.current += 1;
        setIsRunning(false);
        setIsSubmitting(false);
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
    });

    return () => {
      socket.emit("room:leave", { roomId: routeRoomId });
      socket.off("connect");
      socket.off("participant:joined");
      socket.off("participant:left");
      socket.off("code:update");
      socket.off("discussion:message");
      socket.off("problem:changed");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [routeRoomId, user, fetchDiscussions]);

  /* Auto-save code (debounced) via PUT /api/rooms/:roomId */
  useEffect(() => {
    if (!room || roomLoading) return;

    // If change was caused by a remote update, do not schedule a local REST PUT
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
          `http://localhost:5000/api/rooms/${room.roomId}`,
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
        // Silent - we retry on next edit.
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

  /* Best-effort save on unmount */
  useEffect(() => {
    const editorNode = editorRef.current;
    const lastSaved = lastSavedCodeRef.current;
    const roomIdForCleanup = routeRoomId;

    return () => {
      const editorValue = editorNode?.value;
      if (
        editorValue !== undefined &&
        editorValue !== lastSaved &&
        roomIdForCleanup &&
        navigator.sendBeacon
      ) {
        try {
          navigator.sendBeacon(
            `http://localhost:5000/api/rooms/${roomIdForCleanup}`,
            new Blob(
              [JSON.stringify({ code: editorValue })],
              { type: "application/json" }
            )
          );
        } catch {
          // ignore
        }
      }
    };
  }, [routeRoomId]);

  /* ================= COLLAB BAR EFFECTS ================= */
  // Click-outside + Escape for the participants popup.
  const participantsButtonRef = useRef(null);
  const participantsPopupRef = useRef(null);
  const discussionDrawerRef = useRef(null);

  useEffect(() => {
    if (!participantsOpen) return;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        participantsPopupRef.current?.contains(target) ||
        participantsButtonRef.current?.contains(target)
      ) {
        return;
      }
      setParticipantsOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setParticipantsOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [participantsOpen]);

  /* ================= PROBLEM PICKER POPUP EFFECTS ================= */
  // Click-outside + Escape + Auto-focus for the floating problem picker (Creator only).
  useEffect(() => {
    if (!pickerOpen) return;

    // Focus search input when picker opens
    const focusTimer = setTimeout(() => {
      pickerSearchInputRef.current?.focus();
    }, 50);

    const handlePointerDown = (event) => {
      const target = event.target;
      if (
        pickerPopupRef.current?.contains(target) ||
        pickerButtonRef.current?.contains(target)
      ) {
        return;
      }
      setPickerOpen(false);
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setPickerOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [pickerOpen]);

  // Reset the "Copied!" feedback after a short delay.
  useEffect(() => {
    if (!linkCopied) return;
    const timer = setTimeout(() => setLinkCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [linkCopied]);

  /* Leave room */
  const handleLeaveRoom = async () => {
    if (leaving) return;

    setLeaving(true);
    setLeaveError("");

    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${routeRoomId}/leave`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to leave room"
        );
      }

      navigate("/dashboard");
    } catch (err) {
      setLeaveError(err.message);
      setLeaving(false);
    }
  };

  /* End room (Host only) */
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
        `http://localhost:5000/api/rooms/${routeRoomId}/end`,
        {
          method: "POST",
          credentials: "include",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            "Failed to end room"
        );
      }

      setRoom((prev) => (prev ? { ...prev, status: "CLOSED", endedAt: data?.room?.endedAt || new Date() } : prev));
    } catch (err) {
      setEndError(err.message);
    } finally {
      setEnding(false);
    }
  };

  /* Resizers */
  const MIN_PROBLEM = 240;
  const MIN_EDITOR = 320;
  const MIN_OUTPUT = 100;
  const MIN_EDITOR_HEIGHT = 160;

  // Vertical divider between problem panel and editor workspace.
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

  // Horizontal divider between editor and output (vertical drag = output height).
  const outputHeightDrag = useDrag({
    axis: "y",
    onMove: (delta) => {
      setLayout((prev) => {
        const editorNode = editorRef.current;
        const editorArea = editorNode?.closest(".room-editor-area");
        const totalHeight =
          editorArea?.clientHeight ||
          containerRef.current?.clientHeight ||
          0;
        if (!totalHeight) return prev;

        // Target approximately 50-60% of available workspace/column height as maximum
        // while guaranteeing minimum editor height
        const maxOutputPercentage = Math.floor(totalHeight * 0.60);
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

  /* Derived state and helpers */
  const filteredProblems = problems.filter((problem) => {
    const matchesSearch = problem.title
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesDifficulty =
      difficulty === "All" || problem.difficulty === difficulty;
    return matchesSearch && matchesDifficulty;
  });

  const currentUserId = user?.id || user?._id;
  const isCreator = Boolean(
    room &&
      currentUserId &&
      (room.createdBy?._id
        ? String(room.createdBy._id) === String(currentUserId)
        : String(room.createdBy) === String(currentUserId))
  );
  const isClosed = room?.status === "CLOSED";

  const participantsCount = Array.isArray(room?.users)
    ? room.users.length
    : 1;

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

    if (!activeProblem?._id) {
      setOutput("Please select a problem first before running code.");
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsRunning(true);
    setOutput("Running code on visible test cases…");

    const codeSnapshot = code || "";
    const problemIdSnapshot = activeProblem._id;
    const languageSnapshot = room?.language || "cpp";
    const roomIdSnapshot = room?.roomId || null;

    try {
      const response = await fetch("http://localhost:5000/api/submissions/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
          roomId: roomIdSnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      // Discard if token was invalidated by problem change or a newer execution
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
            : response.status === 403
            ? "You do not have permission to execute code in this room."
            : response.status === 404
            ? "Problem or room not found."
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

  const handleSubmitCode = async () => {
    if (isRunning || isSubmitting) return;

    if (!activeProblem?._id) {
      setOutput("Please select a problem first before submitting.");
      return;
    }

    const currentToken = executionTokenRef.current + 1;
    executionTokenRef.current = currentToken;

    setIsSubmitting(true);
    setOutput("Submitting code to full evaluation pipeline…");

    const codeSnapshot = code || "";
    const problemIdSnapshot = activeProblem._id;
    const languageSnapshot = room?.language || "cpp";
    const roomIdSnapshot = room?.roomId || null;

    try {
      const response = await fetch("http://localhost:5000/api/submissions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          problemId: problemIdSnapshot,
          language: languageSnapshot,
          code: codeSnapshot,
          roomId: roomIdSnapshot,
        }),
      });

      const data = await response.json().catch(() => null);

      // Discard if token was invalidated by problem change or a newer execution
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
            : response.status === 403
            ? "You do not have permission to submit code in this room."
            : response.status === 404
            ? "Problem or room not found."
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

  const [selectingProblem, setSelectingProblem] = useState(false);
  const [problemSelectError, setProblemSelectError] = useState("");

  const handleSelectProblem = async (problem) => {
    if (!room) return;
    setProblemSelectError("");
    setSelectingProblem(true);

    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${room.roomId}/problem`,
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
          data?.error?.message ||
            data?.message ||
            "Failed to select problem"
        );
      }

      const updatedRoom = data?.room;
      const updatedProblem = updatedRoom?.selectedProblem || problem;
      const newProblemId = updatedProblem?._id
        ? String(updatedProblem._id)
        : String(updatedProblem);
      lastSelectedProblemIdRef.current = newProblemId;

      executionTokenRef.current += 1;
      setIsRunning(false);
      setIsSubmitting(false);

      setActiveProblem(updatedProblem);
      setRoom(updatedRoom || ((prev) => ({
        ...prev,
        selectedProblem: updatedProblem,
        code: typeof updatedRoom?.code === "string" ? updatedRoom.code : prev.code,
      })));

      // If backend returned initialized starter code in the updated room, set it locally
      if (typeof updatedRoom?.code === "string") {
        isApplyingRemoteCodeRef.current = true;
        setCode(updatedRoom.code);
        lastSavedCodeRef.current = updatedRoom.code;
        setCodeDirty(false);
        codeDirtyRef.current = false;
      }
    } catch (err) {
      setProblemSelectError(err.message);
    } finally {
      setSelectingProblem(false);
    }
  };

  /* ================= LOCAL EDITOR CODE CHANGE ================= */
  const handleEditorCodeChange = (newCode) => {
    isApplyingRemoteCodeRef.current = false;
    setCode(newCode);

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("code:update", {
        roomId: routeRoomId,
        code: newCode,
        timestamp: Date.now(),
      });
    }
  };

  /* ================= MANUAL SAVE ================= */
  // Triggered by the Save button in the editor toolbar.
  // Cancels the pending debounced save and flushes immediately via PUT.
  const handleSaveCode = useCallback(async () => {
    if (!room || roomLoading) return;
    if (codeSaveTimerRef.current) {
      clearTimeout(codeSaveTimerRef.current);
      codeSaveTimerRef.current = null;
    }

    setCodeSaving(true);
    try {
      const response = await fetch(
        `http://localhost:5000/api/rooms/${room.roomId}`,
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
      // Silent — auto-save will retry on next edit.
    } finally {
      setCodeSaving(false);
    }
  }, [room, roomLoading, code]);

  /* ================= COPY ROOM LINK ================= */
  // Builds the share URL from the current browser origin so it works in
  // development and production alike. Falls back gracefully if the
  // clipboard API is unavailable.
  const handleCopyLink = useCallback(async () => {
    if (!routeRoomId) return;
    const url = `${window.location.origin}/room/${routeRoomId}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        // Fallback for older browsers / insecure contexts.
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
      // Silent failure — we keep the previous label.
    }
  }, [routeRoomId]);

  /* ================= DISCUSSION DRAWER RESIZE ================= */
  // Horizontal drag on the drawer's left edge to resize it.
  const MIN_DISCUSSION_WIDTH = 340;
  const MAX_DISCUSSION_WIDTH = 750;

  const discussionWidthDrag = useDrag({
    axis: "x",
    onMove: (delta) => {
      // Dragging the LEFT edge of the drawer leftward (negative delta) should WIDEN it,
      // and dragging rightward (positive delta) should SHRINK it: prev - delta.
      setDiscussionWidth((prev) =>
        Math.min(
          MAX_DISCUSSION_WIDTH,
          Math.max(MIN_DISCUSSION_WIDTH, prev - delta)
        )
      );
    },
  });

  /* ================= SEND DISCUSSION MESSAGE ================= */
  const handleSendDiscussionMessage = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!discussionInput || !discussionInput.trim() || discussionSending) return;

    const trimmed = discussionInput.trim();
    setDiscussionSending(true);

    // Generate ONE collision-resistant clientMessageId for this send attempt
    const clientMessageId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${currentUserId || "user"}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit(
        "discussion:send",
        {
          roomId: routeRoomId,
          message: trimmed,
          clientMessageId,
        },
        async (response) => {
          setDiscussionSending(false);
          if (response?.success) {
            setDiscussionInput("");
          } else {
            // Fallback to REST using the EXACT SAME clientMessageId if socket rejected or failed
            try {
              const res = await fetch(
                `http://localhost:5000/api/discussions/${routeRoomId}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({
                    message: trimmed,
                    clientMessageId,
                  }),
                }
              );
              const data = await res.json().catch(() => null);
              if (res.ok && data?.discussionMessage) {
                setDiscussionMessages((prev) => {
                  const exists = prev.some((m) => {
                    if (
                      m._id &&
                      data.discussionMessage._id &&
                      String(m._id) === String(data.discussionMessage._id)
                    ) {
                      return true;
                    }
                    if (
                      m.clientMessageId &&
                      data.discussionMessage.clientMessageId &&
                      String(m.clientMessageId) ===
                        String(data.discussionMessage.clientMessageId)
                    ) {
                      return true;
                    }
                    return false;
                  });
                  if (exists) return prev;
                  return [...prev, data.discussionMessage];
                });
                setDiscussionInput("");
              }
            } catch {
              // ignore error
            }
          }
        }
      );
    } else {
      // Fallback to REST API if socket is disconnected, using the SAME clientMessageId
      try {
        const response = await fetch(
          `http://localhost:5000/api/discussions/${routeRoomId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              message: trimmed,
              clientMessageId,
            }),
          }
        );
        const data = await response.json().catch(() => null);
        if (response.ok && data?.discussionMessage) {
          setDiscussionMessages((prev) => {
            const exists = prev.some((m) => {
              if (
                m._id &&
                data.discussionMessage._id &&
                String(m._id) === String(data.discussionMessage._id)
              ) {
                return true;
              }
              if (
                m.clientMessageId &&
                data.discussionMessage.clientMessageId &&
                String(m.clientMessageId) ===
                  String(data.discussionMessage.clientMessageId)
              ) {
                return true;
              }
              return false;
            });
            if (exists) return prev;
            return [...prev, data.discussionMessage];
          });
          setDiscussionInput("");
        }
      } catch {
        // ignore error
      } finally {
        setDiscussionSending(false);
      }
    }
  };

  const handlePromptChipClick = (promptText) => {
    setDiscussionInput(promptText);
  };

  const formatMessageTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  /* Loading / error states */
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
          <span aria-hidden="true">🔒</span>
          <span>This room has been ended by the host. Discussion and code execution are closed.</span>
        </div>
      )}

      <div className="room-workspace" ref={containerRef}>
        {/* ================= PROBLEM PANEL ================= */}
        <section
          className="room-problems-panel"
          style={{ "--room-problems-width": `${problemWidth}px` }}
        >
          <div className="room-panel-header room-tabs-header">
            <div className="room-nav-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={leftPanelTab === "problem"}
                className={`room-tab-btn ${
                  leftPanelTab === "problem" ? "is-active" : ""
                }`}
                onClick={() => setLeftPanelTab("problem")}
              >
                📄 Problem
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={leftPanelTab === "submissions"}
                className={`room-tab-btn ${
                  leftPanelTab === "submissions" ? "is-active" : ""
                }`}
                onClick={() => setLeftPanelTab("submissions")}
              >
                📋 Submissions
              </button>
            </div>
            <span className="room-panel-meta">
              {isCreator ? "Creator" : "Participant"}
            </span>
          </div>

          {leftPanelTab === "submissions" ? (
            <div className="room-submissions-container">
              <SubmissionsView
                problemId={activeProblem?._id}
                currentLanguage={room?.language || "cpp"}
                refreshTrigger={submissionHistoryVersion}
              />
            </div>
          ) : (
            <>

          {problemSelectError && (
            <div
              className="room-problem-select-error"
              style={{
                  padding: "8px 14px",
                color: "#fca5a5",
                fontSize: "0.8rem",
                background: "rgba(248, 113, 113, 0.1)",
                borderBottom: "1px solid rgba(248, 113, 113, 0.2)",
              }}
            >
              {problemSelectError}
            </div>
          )}

          {/* Problem Selector Control Bar (Only interactive for Creator) */}
          {isCreator && (
            <div className="room-problem-control-bar">
              <button
                ref={pickerButtonRef}
                type="button"
                className={`room-problem-search-btn ${
                  pickerOpen ? "is-open" : ""
                }`}
                onClick={() => !isClosed && setPickerOpen((prev) => !prev)}
                disabled={isClosed}
                aria-expanded={pickerOpen}
                aria-haspopup="dialog"
                aria-label={
                  activeProblem
                    ? `Change problem from ${activeProblem.title}`
                    : "Search and select a problem"
                }
              >
                <span className="room-problem-search-icon">🔍</span>
                <span className="room-problem-search-text">
                  {activeProblem ? activeProblem.title : "Search problems…"}
                </span>
                <span className="room-problem-search-action">
                  {activeProblem ? "Change" : "Browse"}
                </span>
              </button>

              {/* Floating Problem Picker Popup */}
              {pickerOpen && (
                <div
                  ref={pickerPopupRef}
                  className="room-problem-picker-popup"
                  role="dialog"
                  aria-label="Select a problem"
                >
                  <div className="room-picker-search-header">
                    <span className="room-picker-search-icon">🔍</span>
                    <input
                      ref={pickerSearchInputRef}
                      type="text"
                      className="room-picker-search-input"
                      placeholder="Search problems by name…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      aria-label="Search problems"
                    />
                    <select
                      className="room-picker-difficulty-select"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                      aria-label="Filter by difficulty"
                    >
                      <option value="All">All</option>
                      <option value="Easy">Easy</option>
                      <option value="Medium">Medium</option>
                      <option value="Hard">Hard</option>
                    </select>
                  </div>

                  <div className="room-picker-list">
                    {problemsLoading ? (
                      <p className="room-muted">Loading problems…</p>
                    ) : problemsError ? (
                      <p className="room-muted room-muted-error">
                        {problemsError}
                      </p>
                    ) : filteredProblems.length === 0 ? (
                      <p className="room-muted">
                        No problems match your search.
                      </p>
                    ) : (
                      filteredProblems.map((p) => {
                        const isCurrentActive = activeProblem?._id === p._id;
                        return (
                          <button
                            key={p._id}
                            type="button"
                            disabled={selectingProblem}
                            className={`room-picker-item ${
                              isCurrentActive ? "is-selected" : ""
                            }`}
                            onClick={() => {
                              handleSelectProblem(p);
                              setPickerOpen(false);
                            }}
                          >
                            <div className="room-picker-item-info">
                              <span className="room-picker-item-title">
                                {p.title}
                              </span>
                              {isCurrentActive && (
                                <span className="room-picker-item-current">
                                  Selected
                                </span>
                              )}
                            </div>
                            <span
                              className={`room-problem-difficulty room-difficulty-${p.difficulty?.toLowerCase()}`}
                            >
                              {p.difficulty}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Details of the currently active problem (or a friendly prompt / waiting state). */}
          <div className="room-problem-details">
            {activeProblem ? (
              <>
                <div className="room-problem-details-header">
                  <h2 className="room-problem-details-title">
                    {activeProblem.title}
                  </h2>
                  <span
                    className={`room-problem-difficulty room-difficulty-${activeProblem.difficulty?.toLowerCase()}`}
                  >
                    {activeProblem.difficulty}
                  </span>
                </div>

                {Array.isArray(activeProblem.tags) &&
                  activeProblem.tags.length > 0 && (
                    <div className="room-problem-tag-list">
                      {activeProblem.tags.map((tag, idx) => (
                        <span key={idx} className="room-problem-tag-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                {activeProblem.description && (
                  <div className="room-problem-section">
                    <h3 className="room-problem-section-title">Description</h3>
                    <div className="room-problem-description">
                      {activeProblem.description}
                    </div>
                  </div>
                )}

                {Array.isArray(activeProblem.examples) &&
                  activeProblem.examples.length > 0 && (
                    <div className="room-problem-section">
                      <h3 className="room-problem-section-title">Examples</h3>
                      {activeProblem.examples.map((example, idx) => (
                        <div key={idx} className="room-problem-example">
                          <div className="room-problem-example-header">
                            Example {idx + 1}
                          </div>
                          <div className="room-problem-example-body">
                            <p>
                              <strong>Input:</strong>{" "}
                              <code>{example.input}</code>
                            </p>
                            <p>
                              <strong>Output:</strong>{" "}
                              <code>{example.output}</code>
                            </p>
                            {example.explanation && (
                              <p>
                                <strong>Explanation:</strong>{" "}
                                {example.explanation}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                {Array.isArray(activeProblem.constraints) &&
                  activeProblem.constraints.length > 0 && (
                    <div className="room-problem-section">
                      <h3 className="room-problem-section-title">
                        Constraints
                      </h3>
                      <ul className="room-problem-constraints">
                        {activeProblem.constraints.map((c, idx) => (
                          <li key={idx}>
                            <code>{c}</code>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </>
            ) : isCreator ? (
              <div className="room-problem-empty-creator">
                <div className="room-empty-icon">📂</div>
                <h4>No Problem Selected</h4>
                <p>
                  Click the search bar above to choose a problem for your room.
                </p>
                <button
                  type="button"
                  className="room-empty-select-btn"
                  onClick={() => setPickerOpen(true)}
                >
                  🔍 Select Problem
                </button>
              </div>
            ) : (
              <div className="room-problem-empty-participant">
                <div className="room-empty-icon">⏳</div>
                <h4>Waiting for Problem</h4>
                <p>
                  Waiting for the room creator to select a problem. Once chosen,
                  the problem and starter code will appear automatically.
                </p>
              </div>
            )}
          </div>
          </>
          )}
        </section>

        {/* Vertical divider between problem panel and editor area. */}
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

        {/* ================= EDITOR AREA (editor + output stacked) ================= */}
        <section className="room-editor-area">
          <div className="room-panel-header room-editor-header">
            <div className="room-editor-header-left">
              <span className="room-language-chip">
                {formatLanguage(room?.language)}
              </span>
              <span className="room-save-status">{lastSavedLabel}</span>
            </div>
            <div className="room-editor-header-right">
              <button
                type="button"
                className="room-save-btn"
                onClick={handleSaveCode}
                disabled={codeSaving || !room || isClosed}
                aria-label="Save code"
              >
                {codeSaving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                className="room-run-btn"
                onClick={handleRunCode}
                disabled={isRunning || isSubmitting || isClosed}
              >
                {isRunning ? "Running…" : "Run"}
              </button>
              <button
                type="button"
                className="room-submit-btn"
                onClick={handleSubmitCode}
                disabled={isRunning || isSubmitting || isClosed}
                aria-label="Submit solution"
              >
                {isSubmitting ? "Submitting…" : "Submit"}
              </button>
            </div>
          </div>

          <div className="room-editor-wrapper">
            <textarea
              ref={editorRef}
              className="room-code-editor"
              value={code}
              onChange={(e) => !isClosed && handleEditorCodeChange(e.target.value)}
              readOnly={isClosed}
              placeholder={
                isClosed
                  ? "Room is closed. Editing is disabled."
                  : `Write your ${formatLanguage(room?.language)} solution here…`
              }
              spellCheck="false"
            />
          </div>

          {/* Horizontal divider between editor and output (always visible). */}
          <div
            className="room-resizer room-resizer-horizontal"
            onMouseDown={outputHeightDrag.handlePointerDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize output panel"
            title="Drag to resize"
          >
            <span className="room-resizer-grip" aria-hidden="true" />
          </div>

          <div
            className="room-output-section"
            style={{ "--room-output-height": `${layout.outputHeight}px` }}
          >
            <div className="room-panel-header room-output-header">
              <h3>Output</h3>
              <span className="room-panel-meta">
                {isRunning ? "Running…" : isSubmitting ? "Submitting…" : "Idle"}
              </span>
            </div>
            <div className="room-output-content">
              <pre>{output}</pre>
            </div>
          </div>
        </section>
      </div>

      {/* ================= BOTTOM COLLABORATION BAR ================= */}
      <div
        className="room-collab-bar"
        role="toolbar"
        aria-label="Room collaboration"
      >
        <div className="room-collab-left">
          <span className="room-collab-link-icon" aria-hidden="true">
            🔗
          </span>
          <span className="room-collab-link-text">Room link</span>
          <button
            type="button"
            className={`room-collab-copy-btn${
              linkCopied ? " is-copied" : ""
            }`}
            onClick={handleCopyLink}
            aria-label="Copy room link"
          >
            {linkCopied ? "✓ Copied!" : "📋 Copy"}
          </button>
        </div>

        <div className="room-collab-right">
          <div className="room-collab-participants-wrap">
            <button
              ref={participantsButtonRef}
              type="button"
              className="room-collab-btn"
              onClick={() => setParticipantsOpen((v) => !v)}
              aria-haspopup="dialog"
              aria-expanded={participantsOpen}
              aria-label="Toggle participants list"
            >
              👥 {participantsCount} Participants{" "}
              <span className="room-colbar-caret" aria-hidden="true">
                {participantsOpen ? "▴" : "▾"}
              </span>
            </button>

            {participantsOpen && (
              <div
                ref={participantsPopupRef}
                className="room-participants-popup"
                role="dialog"
                aria-label="Participants in this room"
              >
                <div className="room-participants-header">
                  <span className="room-participants-title">
                    Room Members ({participantsCount}/3)
                  </span>
                </div>
                <ul className="room-participants-list">
                  {Array.isArray(room?.users) && room.users.length > 0 ? (
                    room.users.map((u, idx) => {
                      const uid = u?._id || u;
                      const isSelf =
                        currentUserId &&
                        String(uid) === String(currentUserId);
                      const displayName =
                        u?.name ||
                        (isSelf
                          ? user?.name || "You"
                          : `Participant ${idx + 1}`);

                      return (
                        <li key={uid || idx} className="room-participant-item">
                          <span
                            className="room-participant-avatar"
                            aria-hidden="true"
                          >
                            👤
                          </span>
                          <div className="room-participant-info">
                            <div className="room-participant-name">
                              {isSelf
                                ? `${displayName} (You)`
                                : displayName}
                            </div>
                            <div className="room-participant-status">
                              <span
                                className="room-participant-dot"
                                aria-hidden="true"
                              />
                              Online
                            </div>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="room-participant-item">
                      <span
                        className="room-participant-avatar"
                        aria-hidden="true"
                      >
                        👤
                      </span>
                      <div className="room-participant-info">
                        <div className="room-participant-name">You</div>
                        <div className="room-participant-status">
                          <span
                            className="room-participant-dot"
                            aria-hidden="true"
                          />
                          Online
                        </div>
                      </div>
                    </li>
                  )}
                </ul>
              </div>
            )}
          </div>

          <button
            type="button"
            className={`room-collab-btn room-collab-discussion-btn${
              discussionOpen ? " is-active" : ""
            }`}
            onClick={() => setDiscussionOpen((v) => !v)}
            aria-pressed={discussionOpen}
            aria-label="Toggle discussion drawer"
          >
            💬 Discussion
          </button>
        </div>
      </div>

      {/* ================= DISCUSSION PANEL (Large dedicated panel) ================= */}
      {discussionOpen && (
        <aside
          ref={discussionDrawerRef}
          className="room-discussion-drawer"
          style={{ "--room-discussion-width": `${discussionWidth}px` }}
          role="complementary"
          aria-label="Discussion"
        >
          <div
            className="room-discussion-resizer"
            onMouseDown={discussionWidthDrag.handlePointerDown}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize discussion panel"
            title="Drag to resize"
          >
            <span className="room-resizer-grip" aria-hidden="true" />
          </div>

          <div className="room-discussion-inner">
            <div className="room-discussion-header">
              <div className="room-discussion-header-left">
                <span className="room-discussion-header-icon" aria-hidden="true">
                  💬
                </span>
                <h3 className="room-discussion-title">Discussion</h3>
              </div>
              <button
                type="button"
                className="room-discussion-close"
                onClick={() => setDiscussionOpen(false)}
                aria-label="Close discussion"
                title="Close discussion"
              >
                ×
              </button>
            </div>

            <div className="room-discussion-body" ref={discussionBodyRef}>
              {discussionLoading && discussionMessages.length === 0 ? (
                <div className="discussion-loading-state">
                  <div className="loading-spinner" />
                  <p>Loading messages…</p>
                </div>
              ) : discussionMessages.length === 0 ? (
                <div className="discussion-empty-placeholder">
                  <div className="discussion-empty-icon" aria-hidden="true">
                    💭
                  </div>
                  <h4 className="discussion-empty-heading">No discussion messages yet</h4>
                  <p className="discussion-empty-text">
                    Collaborative room discussions and solution ideation will appear here.
                  </p>
                  <div className="discussion-prompt-chips">
                    <button
                      type="button"
                      className="discussion-prompt-chip"
                      onClick={() => handlePromptChipClick("💡 Let's check the constraints and edge cases.")}
                    >
                      💡 Ask for a hint
                    </button>
                    <button
                      type="button"
                      className="discussion-prompt-chip"
                      onClick={() => handlePromptChipClick("🔍 What approach should we use for this problem?")}
                    >
                      🔍 Discuss the approach
                    </button>
                    <button
                      type="button"
                      className="discussion-prompt-chip"
                      onClick={() => handlePromptChipClick("⚡ What are the boundary cases to test?")}
                    >
                      ⚡ Identify edge cases
                    </button>
                  </div>
                </div>
              ) : (
                <div className="discussion-messages-list">
                  {discussionMessages.map((msg, idx) => {
                    const senderId = msg.user?._id || msg.user;
                    const isSelf =
                      currentUserId &&
                      String(senderId) === String(currentUserId);
                    const senderName =
                      msg.user?.name || (isSelf ? "You" : "Participant");

                    return (
                      <div
                        key={msg._id || idx}
                        className={`discussion-message-item${
                          isSelf ? " is-self" : ""
                        }`}
                      >
                        <div className="discussion-message-meta">
                          <span className="discussion-sender-name">
                            {isSelf ? "You" : senderName}
                          </span>
                          <span className="discussion-message-time">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>
                        <div className="discussion-message-bubble">
                          {msg.message}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <form
              className="room-discussion-footer"
              onSubmit={handleSendDiscussionMessage}
            >
              <div className="room-discussion-input-wrapper">
                <input
                  type="text"
                  className="room-discussion-input"
                  placeholder={
                    isClosed
                      ? "This room has ended. Discussion is closed."
                      : "Write your message…"
                  }
                  value={discussionInput}
                  onChange={(e) => setDiscussionInput(e.target.value)}
                  disabled={discussionSending || isClosed}
                  aria-label="Write your message"
                  maxLength={2000}
                />
                <button
                  type="submit"
                  className="room-discussion-send-btn"
                  disabled={discussionSending || !discussionInput.trim() || isClosed}
                  aria-label="Send message"
                >
                  {discussionSending ? "Sending…" : "Send ➤"}
                </button>
              </div>
            </form>
          </div>
        </aside>
      )}
    </div>
  );
}

function RoomHeader({
  room,
  participantsCount,
  leaving,
  leaveError,
  onLeave,
  isHost,
  isClosed,
  ending,
  endError,
  onEnd,
  onBack,
}) {
  return (
    <header className="dashboard-header room-header">
      <div
        className="logo"
        onClick={onBack}
        style={{ cursor: "pointer" }}
      >
        <h2>CodeSync AI</h2>
      </div>

      <div className="room-header-center">
        <div className="room-header-room">
          <span className="room-header-label">Room</span>
          <span className="room-header-name">
            {room?.roomName || "Loading…"}
          </span>
          {isClosed && <span className="room-closed-badge">Closed</span>}
        </div>
        <div className="room-header-meta">
          <span className="room-header-participants">
            {participantsCount}/3 participants
          </span>
        </div>
      </div>

      <div className="room-header-actions">
        {leaveError && (
          <span className="room-leave-error" title={leaveError}>
            {leaveError}
          </span>
        )}
        {endError && (
          <span className="room-leave-error" title={endError}>
            {endError}
          </span>
        )}
        <button
          type="button"
          className="room-back-btn"
          onClick={onBack}
        >
          ← Dashboard
        </button>
        {isHost && !isClosed && (
          <button
            type="button"
            className="room-end-btn"
            onClick={onEnd}
            disabled={ending || leaving}
            title="End this room for all participants"
          >
            {ending ? "Ending…" : "End Room"}
          </button>
        )}
        <button
          type="button"
          className="room-leave-btn"
          onClick={onLeave}
          disabled={leaving || ending}
        >
          {leaving ? "Leaving…" : "Leave Room"}
        </button>
      </div>
    </header>
  );
}

export default Room;
