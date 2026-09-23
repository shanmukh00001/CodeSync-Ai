---
name: web-and-api-guidelines
description: Core architectural patterns, defensive Mongoose models, C++ engine execution standards, and unified REST API response guidelines for full-stack engineering.
---

# Full-Stack Web & Backend Engineering Guidelines

## 1. Clean Client-Server Architecture
- **Frontend (`frontend/`)**: React + Vite single-page application.
  - Keep UI components decoupled from server transport mechanisms.
  - Centralize API calls and socket listeners cleanly within custom hooks and React context providers.
- **Backend (`backend/`)**: Express / Node.js HTTP & WebSocket server.
  - Maintain strict separation of concerns across controllers, services, middleware, and models.
  - Implement defensive input validation before passing payloads to database models or code execution runners.

---

## 2. Defensive Mongoose Schema & Model Design
- Always enable timestamps: `{ timestamps: true }`.
- Enforce strict indexing on frequently queried fields (e.g. `roomId`, `userId`, `email`).
- Include validation rules (types, `required`, `trim`, `enum`, default values, and boundary checks) on every schema attribute.
- Prevent unhandled query rejections by wrapping database calls in `try/catch` or Express async error handlers.

---

## 3. C++ Engine & CMake Execution Sanity
- **Memory Safety & Lifetime**:
  - Avoid raw pointer arithmetic where modern RAII (`std::unique_ptr`, `std::shared_ptr`, `std::vector`, `std::string`) applies.
  - Prevent dangling references in callbacks or asynchronous execution routines.
- **Strict Bounds & Limits**:
  - Bound execution loops and validate array indices before dereferencing.
  - Enforce timeout and memory limit guards during code compilation and sandboxed runner execution.
- **Build Rigor**:
  - Ensure CMake configuration passes with strict warning flags (`-Wall -Wextra -Werror` / `/W4`).

---

## 4. Standardized JSON API Responses
All REST API endpoints must conform to a consistent JSON response envelope:

### Success Response:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "room": { ... }
  },
  "message": "Operation completed successfully"
}
```

### Error Response:
```json
{
  "success": false,
  "error": {
    "code": "INVALID_INPUT",
    "message": "Detailed and actionable error description"
  }
}
```

---

## 5. Verification & Testing Requirements
- Run unit/integration tests before finalizing modifications (`npm test` in `backend` and `frontend`).
- Verify live state with Chrome DevTools or Postman MCP tools when modifying client-server communications.
