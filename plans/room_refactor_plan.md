# Room Refactoring & Monaco Editor Fixes Plan

## 1. Audit Findings & Root Causes

### 1.1 Monaco Editor Integration & Usability Issues
1. **Stale Textarea API References**: In `Room.jsx`, remote code updates (`socket.on("code:update")`) and unmount beacon saving were still querying `editorRef.current.selectionStart`, `setSelectionRange()`, and `editorRef.current.value` (expecting a standard HTML `<textarea>`). Because `MonacoCodeEditor` wraps Monaco Editor, these calls either evaluated to undefined or failed silently, causing cursor resets and losing editor state during multiplayer edits.
2. **Stale Keybinding Closures**: In `MonacoCodeEditor.jsx`, `onRunCode` and `onSubmitCode` were attached inside `onMount`. Because `onMount` fires only once, these callbacks captured initial closures unless wrapped in mutable refs, causing hot-key commands (Ctrl+Enter, Ctrl+Shift+Enter) to become stale.
3. **Double Toolbars & UI Crowding**: Both the `Room.jsx` top action bar and `MonacoCodeEditor.jsx` inner toolbar rendered overlapping buttons/badges, consuming excessive vertical screen space and creating layout friction.
4. **Resizing Layout Recalculations**: Dragging the problem split or output divider didn't explicitly trigger Monaco's `layout()` recalculation on drag completion, occasionally causing visual clipping or horizontal scroll stutter until window resize.

### 1.2 Room.jsx Monolithic Bloat (2,723 Lines)
The single file `Room.jsx` mixed 7 distinct domains:
1. Room lifecycle, REST synchronization, and debounced auto-saving.
2. Socket.IO multiplayer networking (code streaming, participant joins/leaves, room closures, problem switching).
3. Code execution & submission pipeline, execution token invalidation, and formatting.
4. AI Code Review & Socratic AI Hint requesting, cooldown timers, and error handling.
5. Problem statement rendering, examples, constraints, tabs, and Creator Problem Picker modal.
6. Monaco Editor layout, output console, and split-pane resizers.
7. Collaboration bar, participants dropdown popup, and the technical discussion drawer.

---

## 2. Component Architecture & Decomposition

Clean, cohesive subcomponents and hooks inside `frontend/src/components/room/`:

```
frontend/src/
├── components/
│   ├── MonacoCodeEditor.jsx            [ENHANCE] (Ref-backed keybindings, smooth layout, robust cursor sync)
│   ├── MonacoCodeEditor.css            [POLISH] (Refined styling & dark theme integration)
│   └── room/
│       ├── formatters.js               [NEW] (Execution and submission test-case result formatters)
│       ├── useRoomLayout.js            [NEW] (Resizable split-pane layout with localStorage persistence)
│       ├── useRoomSocket.js            [NEW] (Socket.IO multiplayer connection, listeners, and dispatchers)
│       ├── RoomHeader.jsx              [NEW] (Navigation, room name, live status, End/Leave room actions)
│       ├── RoomProblemPicker.jsx       [NEW] (Searchable problem selector popup for room creators)
│       ├── RoomProblemPanel.jsx        [NEW] (Tab nav: Problem, Submissions, AI Review, AI Hint + Problem details)
│       ├── RoomEditorPanel.jsx         [NEW] (Unified editor toolbar, MonacoCodeEditor wrapper, resizable Output section)
│       ├── RoomCollabBar.jsx           [NEW] (Bottom bar with link copy, participants popup, and discussion toggle)
│       └── RoomDiscussionDrawer.jsx    [NEW] (Resizable side drawer for discussion chat, prompt chips, real-time sync)
└── pages/
    ├── Room.jsx                        [REFACTOR] (Concise coordinator orchestrating state and subcomponents)
    └── Room.css                        [REFACTOR] (Clean modular stylesheet)
```

---

## 3. Detailed Component Decomposition

### Component 1: `useRoomSocket.js`
- Handles Socket.IO lifecycle (`room:join`, `room:leave`, disconnect cleanup).
- Subscribes to `participant:joined`, `participant:left`, `room:closed`, `problem:changed`, `code:update`, `discussion:message`.
- Exposes clean dispatchers: `emitCodeUpdate`, `emitDiscussionMessage`, and helper refs.

### Component 2: `useRoomLayout.js` & `useDrag`
- Manages persisted horizontal problem-panel width and vertical output-panel height.
- Reusable mouse/touch drag handlers for both X and Y dividers.

### Component 3: `MonacoCodeEditor.jsx` (Fixed & Enhanced)
- Uses `useRef` for `onRunCode`, `onSubmitCode`, `onChange` to guarantee keybindings never become stale.
- Exposes `getEditorInstance()` or imperative handle if needed for remote cursor markers and formatting.
- Smooth layout adaptation on panel resize with `automaticLayout: true`.
- Integrated settings toolbar: Theme, Font Size, Tab Size, Word Wrap, Minimap, Format, Copy, Reset.

### Component 4: `RoomEditorPanel.jsx`
- Combines the editor header (language badge, save status, AI Hint button, AI Review button, Run/Submit buttons) with `MonacoCodeEditor`.
- Integrates the horizontal resizer and collapsible Output console with status badges and test results.

### Component 5: `RoomProblemPanel.jsx` & `RoomProblemPicker.jsx`
- Manages tabs: **Problem Description**, **Submissions View**, **AI Review Panel**, **AI Hint Panel**.
- Renders problem statement, tags, examples, and constraints cleanly.
- Creator problem-picker modal with title search, difficulty filter, and keyboard shortcuts (Escape / click outside).

### Component 6: `RoomDiscussionDrawer.jsx`
- Resizable right drawer with width persistence.
- Message feed with auto-scroll, timestamp formatting, empty-state quick prompt chips, and dual Socket.IO + REST fallback.

### Component 7: `RoomHeader.jsx` & `RoomCollabBar.jsx`
- Header: Brand logo, room name, active participant badge, leave/end actions.
- Collab Bar: Share link with copy feedback, participants popup list, discussion drawer toggle.

### Component 8: `Room.jsx` (Orchestrator)
- Reduced from 2,723 lines down to ~250 clean lines.
- Manages top-level state (room, active problem, code, output, AI panels) and passes props to focused subcomponents.

---

## 4. Verification Plan

### Automated Verification
1. **Frontend Production Build**: Run `npm run build` in `frontend` to verify 0 syntax or TypeScript/JSX compile errors.
2. **ESLint / Linter**: Run `npm run lint` in `frontend` to verify clean imports and React hook rules.

### Manual Verification
1. **Monaco Code Editor**: Verify code typing, syntax highlighting, format document, copy code, theme selection, font size, and tab size adjustments.
2. **Keyboard Shortcuts**: Verify `Ctrl+Enter` triggers Run and `Ctrl+Shift+Enter` triggers Submit.
3. **Split-pane Resizing**: Drag vertical divider (problem width) and horizontal divider (output height), ensuring Monaco resizes smoothly without clipping.
4. **Execution & Submission**: Run code on test cases, submit code, verify output console formatting.
5. **AI Hint & AI Review**: Request Socratic hint and AI code review, verify tabs switch and cooldown timers tick down properly.
6. **Collaboration & Discussion**: Open discussion drawer, send message, click prompt chips, toggle participants popup, copy room link.
