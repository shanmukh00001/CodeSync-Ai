---
name: autonomous-loop
description: Runs an autonomous Builder-Verifier cycle over tasks in plans/roadmap.md until all items are completed.
---

# Autonomous Builder-Verifier Loop

Follow these phases sequentially until all checklist items in `plans/roadmap.md` are marked `[x]`.

## Phase 1: Task Discovery
1. Open and inspect `plans/roadmap.md`.
2. Locate the first item matching `- [ ] <Task Name>`.
3. If no incomplete items remain:
   - Output a summary of all completed tasks.
   - Notify the user that the roadmap has been fully executed.
   - Conclude the loop.

## Phase 2: Implementation (Builder)
1. Plan and implement the necessary code edits to fulfill the task.
2. Edit or create workspace files.
3. Ensure syntax, types, and required imports are sound.

## Phase 3: Automated Verification (Verifier)
1. Execute the project's build and automated test suites in the terminal (e.g., `npm test`, `pytest`, `cargo test`, `go test`).
2. Evaluate test output:
   - **If tests or builds fail**:
     1. Analyze the stack trace or error log.
     2. Apply corrective fixes to the code.
     3. Re-run Phase 3 (maximum 3 retry iterations).
   - **If all checks pass**:
     Proceed directly to Phase 4.

## Phase 4: Progression
1. Mark the completed item in `plans/roadmap.md` as `- [x] <Task Name>`.
2. Automatically cycle back to **Phase 1** to pick up the next task.
