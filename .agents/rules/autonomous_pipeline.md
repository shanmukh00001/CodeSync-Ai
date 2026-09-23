# Autonomous SDLC: Builder & Verifier Workflow

## Roles & Responsibilities

1. **Builder Agent (Primary)**:
   - Reads the earliest incomplete task (`- [ ]`) from `plans/roadmap.md`.
   - Implements source code changes, fixes bugs, and handles dependencies.
   - Generates implementation diffs and concise execution notes.

2. **Verifier Agent (Verification Persona / Subagent)**:
   - Assumes a strict, adversarial reviewer persona.
   - Executes build scripts, linters, and automated test suites (`npm test`, `pytest`, `cargo test`, etc.).
   - Validates that code meets requirements and tests edge cases.

## Autonomous Loop Protocol

For every single task in `plans/roadmap.md`, strictly follow this sequence:

1. **Task Selection**: Locate the next incomplete item (`- [ ]`) in `plans/roadmap.md`.
2. **Implementation**: Edit or create the necessary files in the workspace.
3. **Verification**: Run project build and automated test suites.
4. **Branching Decision**:
   - **FAIL**: If tests fail or syntax errors occur, extract the failure trace, apply fixes, and re-run verification. Do not stop or prompt the human operator unless permanently blocked after 3 failed attempts.
   - **PASS**: When all tests and builds pass cleanly, update `plans/roadmap.md` by changing `- [ ]` to `- [x]`.
5. **Next Task**: Immediately transition to the next incomplete task without waiting for user input.

## Execution Constraints
- Do NOT pause or prompt the human operator between tasks.
- Continue automatically until all tasks in `plans/roadmap.md` are marked `[x]`.
