---
trigger: always_on
---

# Verification Requirement
- After creating or modifying endpoints or business logic, always run the relevant unit tests (e.g., `npm run test` in server/client) before reporting completion.
- If a test fails, analyze the stack trace and fix the issue autonomously.