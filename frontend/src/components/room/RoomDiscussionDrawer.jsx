import { useRef, useEffect, useState, useMemo } from "react";
import { formatMessageTime } from "./formatters";

/**
 * Helper to render message text with markdown code blocks, inline code, and bold text
 */
function FormattedMessageContent({ text }) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const parts = useMemo(() => {
    if (!text) return [];
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
    const segments = [];
    let lastIndex = 0;
    let match;

    while ((match = codeBlockRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }
      segments.push({
        type: "code",
        language: match[1] || "code",
        content: match[2].trim(),
      });
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      segments.push({
        type: "text",
        content: text.slice(lastIndex),
      });
    }

    return segments;
  }, [text]);

  const handleCopyCode = (code, idx) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedIndex(idx);
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const renderInlineFormatted = (rawText) => {
    // Process inline `code` and **bold**
    const tokens = rawText.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return tokens.map((token, i) => {
      if (token.startsWith("`") && token.endsWith("`") && token.length > 1) {
        return (
          <code key={i} className="discussion-inline-code">
            {token.slice(1, -1)}
          </code>
        );
      }
      if (token.startsWith("**") && token.endsWith("**") && token.length > 3) {
        return (
          <strong key={i} className="discussion-strong">
            {token.slice(2, -2)}
          </strong>
        );
      }
      return token;
    });
  };

  return (
    <div className="discussion-message-rendered">
      {parts.map((part, idx) => {
        if (part.type === "code") {
          return (
            <div key={idx} className="discussion-code-block-wrap">
              <div className="discussion-code-block-header">
                <span className="discussion-code-lang">{part.language}</span>
                <button
                  type="button"
                  className="discussion-code-copy-btn"
                  onClick={() => handleCopyCode(part.content, idx)}
                  title="Copy code snippet"
                >
                  {copiedIndex === idx ? "✓ Copied" : "Copy"}
                </button>
              </div>
              <pre className="discussion-code-block">
                <code>{part.content}</code>
              </pre>
            </div>
          );
        }
        return (
          <p key={idx} className="discussion-text-para">
            {renderInlineFormatted(part.content)}
          </p>
        );
      })}
    </div>
  );
}

const CATEGORIZED_PROMPTS = [
  {
    category: "Algorithm & Approach",
    icon: "🧠",
    prompts: [
      "Let's discuss Two Pointer vs Sliding Window approach.",
      "What is the optimal recurrence relation for DP here?",
      "Can we solve this using a Monotonic Stack / Queue?",
      "Would a Binary Search on the answer range work?",
    ],
  },
  {
    category: "Complexity & Bounds",
    icon: "⏱️",
    prompts: [
      "What time & space complexity target should we aim for?",
      "Given $N \\le 10^5$, we need an $O(N \\log N)$ or $O(N)$ solution.",
      "Can we optimize space from $O(N)$ to $O(1)$?",
    ],
  },
  {
    category: "Edge Cases & Testing",
    icon: "🧪",
    prompts: [
      "Let's check edge cases: empty input, all negatives, or duplicates.",
      "Watch out for 32-bit integer overflow on large sums.",
      "What happens when the array contains only a single element?",
    ],
  },
];

export default function RoomDiscussionDrawer({
  isOpen,
  onClose,
  discussionWidth,
  discussionWidthDrag,
  discussionLoading,
  discussionMessages,
  discussionInput,
  onInputChange,
  discussionSending,
  onSendMessage,
  onPromptChipClick,
  currentUserId,
  isClosed,
}) {
  const discussionBodyRef = useRef(null);
  const discussionDrawerRef = useRef(null);
  const textareaRef = useRef(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [activeCategory, setActiveCategory] = useState("Algorithm & Approach");
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Filter messages by search query
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim()) return discussionMessages;
    const query = searchQuery.toLowerCase();
    return discussionMessages.filter(
      (m) =>
        m.message?.toLowerCase().includes(query) ||
        m.user?.name?.toLowerCase().includes(query)
    );
  }, [discussionMessages, searchQuery]);

  // Track scroll position to show "Scroll to bottom" button
  const handleScroll = () => {
    const container = discussionBodyRef.current;
    if (!container) return;
    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowScrollBottom(distFromBottom > 160);
  };

  const scrollToBottom = () => {
    if (discussionBodyRef.current) {
      discussionBodyRef.current.scrollTo({
        top: discussionBodyRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Auto-scroll on new incoming message when near bottom
  useEffect(() => {
    if (!isOpen) return;
    const container = discussionBodyRef.current;
    if (container) {
      const isNearBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight < 180;
      if (isNearBottom) {
        requestAnimationFrame(() => {
          if (discussionBodyRef.current) {
            discussionBodyRef.current.scrollTop =
              discussionBodyRef.current.scrollHeight;
          }
        });
      }
    }
  }, [discussionMessages, isOpen]);

  // Handle Ctrl+Enter / Enter in textarea
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(e);
    }
  };

  // Helper to insert markdown tags into textarea
  const insertFormatting = (prefix, suffix = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = discussionInput || "";
    const selected = val.substring(start, end);
    const replacement = `${prefix}${selected || "code"}${suffix}`;
    const newVal = val.substring(0, start) + replacement + val.substring(end);
    onInputChange(newVal);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selected ? selected.length : 4)
      );
    }, 0);
  };

  if (!isOpen) return null;

  return (
    <aside
      ref={discussionDrawerRef}
      className="room-discussion-drawer"
      style={{ "--room-discussion-width": `${discussionWidth}px` }}
      role="complementary"
      aria-label="Technical Discussion"
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
        {/* Header */}
        <div className="room-discussion-header">
          <div className="room-discussion-header-left">
            <span className="room-discussion-badge-icon" aria-hidden="true">
              💬
            </span>
            <div>
              <h3 className="room-discussion-title">Technical Discussion</h3>
              <span className="room-discussion-subtitle">
                {discussionMessages.length} message
                {discussionMessages.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>

          <div className="room-discussion-header-actions">
            <button
              type="button"
              className={`room-discussion-header-btn${
                showSearch ? " is-active" : ""
              }`}
              onClick={() => {
                setShowSearch((prev) => !prev);
                if (showSearch) setSearchQuery("");
              }}
              title="Search discussion messages"
              aria-label="Search messages"
            >
              🔍
            </button>
            <button
              type="button"
              className="room-discussion-close"
              onClick={onClose}
              aria-label="Close discussion"
              title="Close discussion"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {showSearch && (
          <div className="discussion-search-bar">
            <input
              type="text"
              className="discussion-search-input"
              placeholder="Search by keyword or participant…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                className="discussion-search-clear"
                onClick={() => setSearchQuery("")}
              >
                ✕
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className="room-discussion-body"
          ref={discussionBodyRef}
          onScroll={handleScroll}
        >
          {discussionLoading && discussionMessages.length === 0 ? (
            <div className="discussion-loading-state">
              <div className="loading-spinner" />
              <p>Loading discussion stream…</p>
            </div>
          ) : discussionMessages.length === 0 ? (
            <div className="discussion-empty-placeholder">
              <div className="discussion-empty-icon">💡</div>
              <h4 className="discussion-empty-heading">
                Start the Technical Discussion
              </h4>
              <p className="discussion-empty-text">
                Brainstorm time/space complexities, edge cases, and algorithmic
                approaches with your peers.
              </p>

              {/* Categorized Prompt Tabs */}
              <div className="discussion-category-tabs">
                {CATEGORIZED_PROMPTS.map((cat) => (
                  <button
                    key={cat.category}
                    type="button"
                    className={`discussion-category-tab${
                      activeCategory === cat.category ? " is-active" : ""
                    }`}
                    onClick={() => setActiveCategory(cat.category)}
                  >
                    <span>{cat.icon}</span> {cat.category}
                  </button>
                ))}
              </div>

              {/* Active Category Chips */}
              <div className="discussion-prompt-chips">
                {CATEGORIZED_PROMPTS.find(
                  (c) => c.category === activeCategory
                )?.prompts.map((promptText, i) => (
                  <button
                    key={i}
                    type="button"
                    className="discussion-prompt-chip"
                    onClick={() => onPromptChipClick(promptText)}
                  >
                    {promptText}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="discussion-messages-list">
              {filteredMessages.length === 0 ? (
                <div className="discussion-no-results">
                  No messages matching &ldquo;{searchQuery}&rdquo;
                </div>
              ) : (
                filteredMessages.map((msg, idx) => {
                  const senderId = msg.user?._id || msg.user?.id || msg.user;
                  const isSelf =
                    currentUserId && String(senderId) === String(currentUserId);
                  const senderName =
                    (isSelf ? "You" : msg.user?.name) ||
                    msg.user?.username ||
                    "Participant";
                  const initial = (senderName[0] || "U").toUpperCase();

                  return (
                    <div
                      key={msg._id || msg.clientMessageId || idx}
                      className={`discussion-message-item${
                        isSelf ? " is-self" : ""
                      }`}
                    >
                      <div className="discussion-message-avatar" title={senderName}>
                        {initial}
                      </div>

                      <div className="discussion-message-content-col">
                        <div className="discussion-message-meta">
                          <span className="discussion-sender-name">
                            {isSelf ? `${senderName} (You)` : senderName}
                          </span>
                          <span className="discussion-message-time">
                            {formatMessageTime(msg.createdAt)}
                          </span>
                        </div>

                        <div className="discussion-message-bubble">
                          <FormattedMessageContent text={msg.message} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Jump to bottom button */}
          {showScrollBottom && (
            <button
              type="button"
              className="discussion-scroll-bottom-btn"
              onClick={scrollToBottom}
              title="Scroll to latest messages"
            >
              ↓ Latest Messages
            </button>
          )}
        </div>

        {/* Footer & Input Area */}
        <form className="room-discussion-footer" onSubmit={onSendMessage}>
          {/* Quick Toolbar */}
          <div className="discussion-toolbar">
            <button
              type="button"
              className="discussion-tool-btn"
              onClick={() => insertFormatting("```cpp\n", "\n```")}
              title="Insert Code Block (```)"
              disabled={isClosed}
            >
              &lt;/&gt; Code
            </button>
            <button
              type="button"
              className="discussion-tool-btn"
              onClick={() => insertFormatting("`", "`")}
              title="Insert Inline Code (`)"
              disabled={isClosed}
            >
              `inline`
            </button>
            <button
              type="button"
              className="discussion-tool-btn"
              onClick={() => insertFormatting("**", "**")}
              title="Insert Bold Text (**)"
              disabled={isClosed}
            >
              <b>B</b> Bold
            </button>
            <button
              type="button"
              className="discussion-tool-btn"
              onClick={() => insertFormatting("$O(", ")$")}
              title="Insert Big-O Complexity"
              disabled={isClosed}
            >
              <i>O(N)</i>
            </button>
          </div>

          <div className="room-discussion-input-wrapper">
            <textarea
              ref={textareaRef}
              className="room-discussion-textarea"
              placeholder={
                isClosed
                  ? "This room has ended. Discussion is closed."
                  : "Type technical notes or code snippet… (Enter to send, Shift+Enter for newline)"
              }
              value={discussionInput}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={discussionSending || isClosed}
              aria-label="Discussion message"
              rows={2}
              maxLength={2000}
            />
            <button
              type="submit"
              className="room-discussion-send-btn"
              disabled={
                discussionSending || !discussionInput.trim() || isClosed
              }
              aria-label="Send message"
            >
              {discussionSending ? "..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </aside>
  );
}
