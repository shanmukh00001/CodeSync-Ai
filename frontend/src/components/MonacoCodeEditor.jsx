import { useRef, useEffect, useState, useCallback } from "react";
import Editor from "@monaco-editor/react";
import "./MonacoCodeEditor.css";

const THEMES = [
  { id: "codesync-dark", label: "CodeSync Dark" },
  { id: "codesync-midnight", label: "OLED Midnight" },
  { id: "vs-dark", label: "VS Dark" },
  { id: "codesync-light", label: "Clean Light" },
];

const FONT_SIZES = [12, 13, 14, 15, 16, 18, 20];
const TAB_SIZES = [2, 4];

// Normalize language key to Monaco language identifier
function getMonacoLanguage(lang) {
  if (!lang) return "cpp";
  const l = String(lang).toLowerCase().trim();
  if (l === "c++" || l === "cpp") return "cpp";
  if (l === "py" || l === "python") return "python";
  if (l === "js" || l === "javascript") return "javascript";
  if (l === "java") return "java";
  return l;
}

/**
 * Configure Custom Monaco Themes
 */
function defineCustomThemes(monaco) {
  monaco.editor.defineTheme("codesync-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "8b949e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff7b72" },
      { token: "string", foreground: "a5d6ff" },
      { token: "number", foreground: "79c0ff" },
      { token: "type", foreground: "ffa657" },
      { token: "function", foreground: "d2a8ff" },
    ],
    colors: {
      "editor.background": "#0d1117",
      "editor.foreground": "#c9d1d9",
      "editor.lineHighlightBackground": "#161b22",
      "editor.lineHighlightBorder": "#21262d",
      "editorLineNumber.foreground": "#6e7681",
      "editorLineNumber.activeForeground": "#58a6ff",
      "editorGutter.background": "#0d1117",
      "editorCursor.foreground": "#58a6ff",
      "editor.selectionBackground": "#264f78",
      "editor.inactiveSelectionBackground": "#1f3a58",
    },
  });

  monaco.editor.defineTheme("codesync-midnight", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "7a828e", fontStyle: "italic" },
      { token: "keyword", foreground: "ff6b6b" },
      { token: "string", foreground: "80d8ff" },
      { token: "number", foreground: "69f0ae" },
      { token: "type", foreground: "ffd54f" },
      { token: "function", foreground: "ea80fc" },
    ],
    colors: {
      "editor.background": "#000000",
      "editor.foreground": "#f0f6fc",
      "editor.lineHighlightBackground": "#121212",
      "editorLineNumber.foreground": "#555555",
      "editorLineNumber.activeForeground": "#69f0ae",
      "editorGutter.background": "#000000",
      "editorCursor.foreground": "#69f0ae",
      "editor.selectionBackground": "#1b3a57",
    },
  });

  monaco.editor.defineTheme("codesync-light", {
    base: "vs",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6e7781", fontStyle: "italic" },
      { token: "keyword", foreground: "cf222e" },
      { token: "string", foreground: "0a3069" },
      { token: "number", foreground: "0550ae" },
      { token: "type", foreground: "953800" },
      { token: "function", foreground: "8250df" },
    ],
    colors: {
      "editor.background": "#ffffff",
      "editor.foreground": "#24292f",
      "editor.lineHighlightBackground": "#f6f8fa",
      "editorLineNumber.foreground": "#8c959f",
      "editorLineNumber.activeForeground": "#0969da",
      "editorGutter.background": "#ffffff",
      "editorCursor.foreground": "#0969da",
      "editor.selectionBackground": "#b4d5fe",
    },
  });
}

/**
 * Reusable Monaco Code Editor component
 */
export default function MonacoCodeEditor({
  value = "",
  onChange,
  language = "cpp",
  readOnly = false,
  onRunCode,
  onSubmitCode,
  onSave,
  onReset,
  onCursorChange,
  showToolbar = true,
  showLangBadge = false,
  remoteCursors = [],
  extraToolbarActions = null,
  height = "100%",
  className = "",
  placeholder: _placeholder = "",
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const wrapperRef = useRef(null);
  const decorationsRef = useRef([]);
  const lastRemoteCursorsRef = useRef("");

  // Refs for tracking local typing vs external state push to avoid cursor jumping
  const lastLocalValueRef = useRef(value ?? "");
  const isLocalChangeRef = useRef(false);

  // Mutable refs for latest callback execution
  const runCodeRef = useRef(onRunCode);
  const submitCodeRef = useRef(onSubmitCode);
  const saveCodeRef = useRef(onSave);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);

  useEffect(() => {
    runCodeRef.current = onRunCode;
  }, [onRunCode]);

  useEffect(() => {
    submitCodeRef.current = onSubmitCode;
  }, [onSubmitCode]);

  useEffect(() => {
    saveCodeRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onCursorChangeRef.current = onCursorChange;
  }, [onCursorChange]);

  // Editor settings persisted locally
  const [theme, setTheme] = useState(
    () => localStorage.getItem("codesync_editor_theme") || "codesync-dark"
  );
  const [fontSize, setFontSize] = useState(
    () => parseInt(localStorage.getItem("codesync_editor_fontsize"), 10) || 14
  );
  const [tabSize, setTabSize] = useState(
    () => parseInt(localStorage.getItem("codesync_editor_tabsize"), 10) || 4
  );
  const [wordWrap, setWordWrap] = useState(
    () => localStorage.getItem("codesync_editor_wordwrap") === "true"
  );
  const [minimap, setMinimap] = useState(
    () => localStorage.getItem("codesync_editor_minimap") === "true"
  );
  const [isCopied, setIsCopied] = useState(false);

  const monacoLang = getMonacoLanguage(language);

  // Sync settings with local storage
  useEffect(() => {
    localStorage.setItem("codesync_editor_theme", theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem("codesync_editor_fontsize", String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem("codesync_editor_tabsize", String(tabSize));
  }, [tabSize]);

  useEffect(() => {
    localStorage.setItem("codesync_editor_wordwrap", String(wordWrap));
  }, [wordWrap]);

  useEffect(() => {
    localStorage.setItem("codesync_editor_minimap", String(minimap));
  }, [minimap]);

  // Before mount - define themes
  const handleEditorWillMount = useCallback((monaco) => {
    defineCustomThemes(monaco);
  }, []);

  // Handle Editor Mount
  const handleEditorDidMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    defineCustomThemes(monaco);
    monaco.editor.setTheme(theme);

    // Run Code: Ctrl/Cmd + Enter
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCodeRef.current?.();
    });

    // Submit: Ctrl/Cmd + Shift + Enter
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => {
        submitCodeRef.current?.();
      }
    );

    // Save Draft: Ctrl/Cmd + S
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      saveCodeRef.current?.();
    });

    // Cursor position tracker for multiplayer
    editor.onDidChangeCursorPosition((e) => {
      if (e && e.position) {
        onCursorChangeRef.current?.({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    // Configure tab size
    editor.getModel()?.updateOptions({ tabSize });
    editor.layout();
  }, [tabSize, theme]);

  // Dynamic ResizeObserver to guarantee layout recalculation on splitter drags
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof window === "undefined" || !window.ResizeObserver) {
      return;
    }

    const ro = new ResizeObserver(() => {
      if (editorRef.current) {
        editorRef.current.layout();
      }
    });

    ro.observe(wrapper);
    return () => ro.disconnect();
  }, []);

  // Sync theme when state changes
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(theme);
    }
  }, [theme]);

  // Handle controlled value changes without hijacking local cursor
  useEffect(() => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const currentEditorVal = editor.getValue();
    const normalizedProp = (value ?? "").replace(/\r\n/g, "\n");
    const normalizedCurrent = currentEditorVal.replace(/\r\n/g, "\n");

    // If buffer already matches prop, do not re-set
    if (normalizedCurrent === normalizedProp) {
      lastLocalValueRef.current = normalizedProp;
      return;
    }

    // Only update if change came externally and not from in-flight user typing
    if (!isLocalChangeRef.current && normalizedProp !== lastLocalValueRef.current) {
      lastLocalValueRef.current = normalizedProp;
      const position = editor.getPosition();
      editor.setValue(normalizedProp);
      if (position) {
        const lineCount = editor.getModel()?.getLineCount() || 1;
        const targetLine = Math.min(position.lineNumber, lineCount);
        const maxCol = editor.getModel()?.getLineMaxColumn(targetLine) || 1;
        const targetCol = Math.min(position.column, maxCol);
        editor.setPosition({ lineNumber: targetLine, column: targetCol });
      }
    }
  }, [value]);

  // Update language on existing model when language prop changes
  useEffect(() => {
    if (editorRef.current && monacoRef.current) {
      const model = editorRef.current.getModel();
      if (model) {
        monacoRef.current.editor.setModelLanguage(model, monacoLang);
      }
    }
  }, [monacoLang]);

  // Update tab size on existing model when setting changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.getModel()?.updateOptions({ tabSize });
    }
  }, [tabSize]);

  // Update Remote Cursors Decorations (Multiplayer) with dynamic style injection
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const serialized = JSON.stringify(remoteCursors || []);
    if (serialized === lastRemoteCursorsRef.current) return;
    lastRemoteCursorsRef.current = serialized;

    const editor = editorRef.current;
    const monaco = monacoRef.current;

    // Inject per-peer dynamic CSS rules for unique user colors
    if (Array.isArray(remoteCursors)) {
      let styleTag = document.getElementById("monaco-remote-cursor-styles");
      if (!styleTag) {
        styleTag = document.createElement("style");
        styleTag.id = "monaco-remote-cursor-styles";
        document.head.appendChild(styleTag);
      }

      let cssRules = "";
      remoteCursors.forEach((rc) => {
        if (!rc || !rc.id) return;
        const color = rc.color || "#00d2ff";
        const safeId = String(rc.id).replace(/[^a-zA-Z0-9_-]/g, "_");
        cssRules += `
          .remote-cursor-line-${safeId} {
            background-color: ${color}22 !important;
            border-left: 2px solid ${color} !important;
          }
          .remote-cursor-badge-${safeId} {
            background-color: ${color} !important;
            color: #ffffff !important;
            border-radius: 3px !important;
            padding: 1px 5px !important;
            font-size: 10px !important;
            font-weight: 600 !important;
            margin-left: 4px !important;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
          }
        `;
      });
      styleTag.textContent = cssRules;
    }

    const newDecorations = [];
    if (Array.isArray(remoteCursors)) {
      remoteCursors.forEach((rc) => {
        if (!rc || !rc.position) return;
        const line = Math.max(1, rc.position.lineNumber || 1);
        const col = Math.max(1, rc.position.column || 1);
        const peerName = rc.name || rc.username || "Peer";
        const safeId = String(rc.id || "peer").replace(/[^a-zA-Z0-9_-]/g, "_");

        newDecorations.push({
          range: new monaco.Range(line, col, line, col),
          options: {
            className: `remote-cursor-line remote-cursor-line-${safeId}`,
            hoverMessage: { value: `**${peerName}** is typing here` },
            after: {
              content: ` 📍 ${peerName}`,
              inlineClassName: `remote-cursor-badge remote-cursor-badge-${safeId}`,
            },
          },
        });
      });
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );
  }, [remoteCursors]);

  // Copy code handler
  const handleCopy = () => {
    const codeToCopy = editorRef.current ? editorRef.current.getValue() : value;
    navigator.clipboard.writeText(codeToCopy || "").then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  // Format code handler
  const handleFormatCode = () => {
    if (editorRef.current) {
      editorRef.current.getAction("editor.action.formatDocument")?.run();
    }
  };

  const handleEditorChange = (newVal) => {
    const val = newVal ?? "";
    lastLocalValueRef.current = val;
    isLocalChangeRef.current = true;
    onChangeRef.current?.(val);
    setTimeout(() => {
      isLocalChangeRef.current = false;
    }, 50);
  };

  return (
    <div className={`monaco-editor-container ${className}`}>
      {showToolbar && (
        <div className="monaco-toolbar">
          <div className="monaco-toolbar-left">
            {showLangBadge && (
              <span className="monaco-lang-badge">
                {language.toUpperCase()}
              </span>
            )}
            {extraToolbarActions}
          </div>

          <div className="monaco-toolbar-right">
            {/* Theme Selector */}
            <select
              className="monaco-select"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              title="Editor Theme"
              aria-label="Editor Theme"
            >
              {THEMES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Font Size Selector */}
            <select
              className="monaco-select"
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              title="Font Size"
              aria-label="Font Size"
            >
              {FONT_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}px
                </option>
              ))}
            </select>

            {/* Tab Size Selector */}
            <select
              className="monaco-select"
              value={tabSize}
              onChange={(e) => setTabSize(Number(e.target.value))}
              title="Tab Size"
              aria-label="Tab Size"
            >
              {TAB_SIZES.map((ts) => (
                <option key={ts} value={ts}>
                  {ts} Spaces
                </option>
              ))}
            </select>

            {/* Word Wrap Toggle */}
            <button
              type="button"
              className={`monaco-btn-icon ${wordWrap ? "is-active" : ""}`}
              onClick={() => setWordWrap((prev) => !prev)}
              title={`Word Wrap: ${wordWrap ? "ON" : "OFF"}`}
              aria-label="Toggle Word Wrap"
            >
              Wrap
            </button>

            {/* Minimap Toggle */}
            <button
              type="button"
              className={`monaco-btn-icon ${minimap ? "is-active" : ""}`}
              onClick={() => setMinimap((prev) => !prev)}
              title={`Minimap: ${minimap ? "ON" : "OFF"}`}
              aria-label="Toggle Minimap"
            >
              Map
            </button>

            {/* Format Document */}
            <button
              type="button"
              className="monaco-btn-icon"
              onClick={handleFormatCode}
              title="Format Code (Shift+Alt+F)"
              aria-label="Format Code (Shift+Alt+F)"
            >
              Format
            </button>

            {/* Copy Code */}
            <button
              type="button"
              className="monaco-btn-icon"
              onClick={handleCopy}
              title="Copy Code"
              aria-label="Copy Code"
            >
              {isCopied ? "Copied!" : "Copy"}
            </button>

            {/* Reset to Starter Boilerplate */}
            {onReset && (
              <button
                type="button"
                className="monaco-btn-icon monaco-btn-danger"
                onClick={onReset}
                title="Reset to Starter Template"
                aria-label="Reset Code"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      )}

      <div className="monaco-editor-wrapper" ref={wrapperRef}>
        <Editor
          height={height}
          language={monacoLang}
          defaultValue={(value ?? "").replace(/\r\n/g, "\n")}
          value={(value ?? "").replace(/\r\n/g, "\n")}
          theme={theme}
          beforeMount={handleEditorWillMount}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          loading={
            <div className="monaco-loading-spinner">
              <div className="spinner-dot"></div>
              <span>Loading CodeSync Editor...</span>
            </div>
          }
          options={{
            readOnly,
            fontSize,
            tabSize,
            wordWrap: wordWrap ? "on" : "off",
            minimap: { enabled: minimap },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            fontFamily:
              "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            fontLigatures: true,
            lineNumbers: "on",
            renderLineHighlight: "all",
            bracketPairColorization: { enabled: true },
            guides: {
              bracketPairs: true,
              indentation: true,
            },
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "off",
            smoothScrolling: false,
            padding: { top: 12, bottom: 12 },
            autoClosingBrackets: "languageDefined",
            autoClosingQuotes: "languageDefined",
            autoClosingDelete: "always",
            autoClosingOvertype: "always",
            formatOnPaste: false,
            formatOnType: false,
          }}
        />
      </div>
    </div>
  );
}
