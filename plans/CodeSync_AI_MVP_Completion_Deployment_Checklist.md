# CodeSync AI — MVP Completion & Deployment Checklist

**Current stage:** Stage 11 completed and verified  
**Goal:** Finish the remaining MVP work, deploy the application, and perform production verification.

---

## 0. Current Baseline

The following work is already completed and should **not** be treated as MVP blockers:

- [x] Local AI provider implemented.
- [x] Ollama installed and working.
- [x] `qwen2.5-coder:7b` installed and responding.
- [x] Local AI review, hint, and recommendation flows verified live.
- [x] C++, Python, JavaScript, and Java Run/Submit flows verified.
- [x] Hidden-test privacy verified.
- [x] Solo-code persistence/save implemented.
- [x] Workspace navigation/output-panel UX fixes implemented.
- [x] Room duplicate Copy Link removed.
- [x] Activity heatmap UI changes implemented.
- [x] Stage 11 regression suite passed.
- [x] AI Review regression: 42/42 passed.
- [x] AI Hint regression: 24/24 passed.
- [x] Recommendation regression: 59/59 passed.
- [x] Submission route regression: 11/11 passed.
- [x] Frontend lint: 0 errors.
- [x] Frontend production build: passed.
- [x] C++ latency investigation completed.
- [x] GCC `-O0` experiment completed; no meaningful end-to-end improvement.
- [x] C++ performance issue documented as an environment/resource constraint.

> **Important:** Do not spend MVP time optimizing C++ GCC latency further unless deployment testing exposes a new issue.

---

# 1. MVP BLOCKERS — Finish These First

## 1.1 Production Configuration

- [ ] Create/verify production environment configuration.
- [ ] Separate development `.env` from production secrets.
- [ ] Verify all required backend environment variables.
- [ ] Verify frontend API/base URL configuration.
- [ ] Generate/use strong production secrets.
- [ ] Confirm `NODE_ENV=production`.
- [ ] Ensure secrets are not committed to Git.
- [ ] Add/update `.env.example` with variable names but no secrets.
- [ ] Confirm production CORS configuration.
- [ ] Confirm HTTPS/session/cookie configuration if applicable.

### Local AI deployment decision

- [ ] Decide whether production uses a hosted AI provider or self-hosted Ollama.
- [ ] If using Ollama: install it on the deployment machine.
- [ ] Pull the required model.
- [ ] Configure `LOCAL_AI_BASE_URL`.
- [ ] Configure `LOCAL_AI_MODEL`.
- [ ] Configure `LOCAL_AI_TIMEOUT_MS`.
- [ ] Verify Ollama/model availability after deployment.
- [ ] Verify AI failures return controlled `503 AI_SERVICE_UNAVAILABLE`.

---

# 2. Database & Persistent Data

- [ ] Verify production database configuration.
- [ ] Verify migrations/schema are reproducible from a clean environment.
- [ ] Run production migrations.
- [ ] Confirm required database indexes.
- [ ] Verify required seed/problem data.
- [ ] Verify database connection failure handling.
- [ ] Confirm production is not accidentally using a development database.
- [ ] Configure production backups/snapshots.
- [ ] Test the restore procedure.
- [ ] Confirm passwords/secrets are never logged.

---

# 3. Authentication & Authorization

Test the complete lifecycle:

- [ ] Register.
- [ ] Login.
- [ ] Logout.
- [ ] Invalid credentials.
- [ ] Duplicate account handling.
- [ ] Session/token expiration.
- [ ] Protected routes reject unauthenticated requests.
- [ ] Users cannot access another user's private data.
- [ ] Room authorization works.
- [ ] Submission/history authorization works.
- [ ] AI endpoints enforce intended user/problem boundaries.

---

# 4. Core Coding Platform MVP Flow

### Problem discovery

- [ ] Dashboard loads.
- [ ] Problems are listed.
- [ ] Problem details open.
- [ ] Examples/constraints are readable.
- [ ] Problem ID/slug displays correctly.

### Workspace

- [ ] C++ editor works.
- [ ] Python editor works.
- [ ] JavaScript editor works.
- [ ] Java editor works.
- [ ] Starter code loads.
- [ ] Code editing works.
- [ ] Save works.
- [ ] Auto-save works.
- [ ] Refresh restores saved code.
- [ ] Switching problems preserves separate drafts.
- [ ] Switching languages preserves separate drafts.
- [ ] Run works.
- [ ] Submit works.
- [ ] Accepted result displays.
- [ ] Wrong Answer displays.
- [ ] Runtime error displays.
- [ ] Compilation error displays.
- [ ] Timeout displays.
- [ ] Hidden tests are never exposed.

### Submission history

- [ ] Submission is persisted.
- [ ] Submission status is correct.
- [ ] Submission language is correct.
- [ ] Submission timestamp is correct.
- [ ] History loads after refresh/login.
- [ ] Failed submissions do not corrupt user state.

---

# 5. Multi-Language Production Verification

Run at least one known-good and one known-bad submission for each:

| Language | Run | Submit | Error Handling | Timeout | Hidden Tests |
|---|---|---|---|---|---|
| C++ | [ ] | [ ] | [ ] | [ ] | [ ] |
| Python | [ ] | [ ] | [ ] | [ ] | [ ] |
| JavaScript | [ ] | [ ] | [ ] | [ ] | [ ] |
| Java | [ ] | [ ] | [ ] | [ ] | [ ] |

> **C++ note:** The current ~30s compilation benchmark is not an MVP blocker by itself. The controlled `-O0` experiment did not materially reduce wall-clock latency.

---

# 6. AI MVP Verification

## Review

- [ ] Review works with Ollama.
- [ ] Structured response validates.
- [ ] `actionableSuggestions` contains 1–5 items.
- [ ] `strengths` validates.
- [ ] Malformed model output is rejected safely.
- [ ] AI timeout returns a controlled error.
- [ ] Ollama unavailable returns `503 AI_SERVICE_UNAVAILABLE`.
- [ ] Model chain-of-thought is not surfaced.

## Hint

- [ ] Hint request works.
- [ ] Hint remains Socratic.
- [ ] Hint does not reveal a complete solution.
- [ ] Timeout is handled correctly.
- [ ] Ollama unavailable is handled correctly.

## Recommendations

- [ ] Recommendations load.
- [ ] Recommendation rationale is structured.
- [ ] Recommendations do not fabricate unsupported user history.
- [ ] Recommendation endpoint works after deployment.

---

# 7. Rooms / Collaboration

If collaboration is part of the MVP:

- [ ] Create room.
- [ ] Join room.
- [ ] Room link works.
- [ ] Copy Link works.
- [ ] No duplicate Copy Link control.
- [ ] Room state synchronizes between two browser sessions.
- [ ] Code/editor synchronization works.
- [ ] Disconnect/reconnect behavior is acceptable.
- [ ] Unauthorized room access is rejected.
- [ ] Room cleanup/expiration behavior is verified.

---

# 8. Frontend Production Readiness

- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] Production build loads without console errors.
- [ ] API requests use production backend URL.
- [ ] No localhost URLs remain in production configuration.
- [ ] No development/debug UI remains.
- [ ] No mock provider is accidentally enabled.
- [ ] Loading states work.
- [ ] Empty states work.
- [ ] Error states work.
- [ ] Mobile layout verified.
- [ ] Desktop layout verified.

### Minimum browser checks

- [ ] 1440×900
- [ ] 768×1024
- [ ] 375×667

---

# 9. Security Pre-Deployment Check

- [ ] Secrets removed from source code.
- [ ] `.env` ignored by Git.
- [ ] Production secrets generated/rotated.
- [ ] Authentication protected.
- [ ] Authorization checked server-side.
- [ ] User code executes only inside the intended sandbox.
- [ ] Execution timeouts enforced.
- [ ] Resource limits enforced.
- [ ] Hidden tests cannot be returned to clients.
- [ ] AI prompts do not expose sensitive user/database information.
- [ ] AI output is treated as untrusted data.
- [ ] Request body/input size limits are configured.
- [ ] CORS restricted to expected production origins.
- [ ] HTTPS enabled.
- [ ] Production errors do not expose stack traces/internal paths.

---

# 10. Piston / Code Execution Deployment

This is a **critical deployment dependency**.

- [ ] Decide where Piston will run.
- [ ] Verify deployed backend can reach Piston.
- [ ] Verify Piston has all four required runtimes:
  - [ ] C++ 10.2.0
  - [ ] Python 3.10.0
  - [ ] Node 18.15.0
  - [ ] Java 15.0.2
- [ ] Verify compiler/runtime versions after deployment.
- [ ] Verify execution limits.
- [ ] Verify network isolation/security.
- [ ] Verify concurrent execution behavior.
- [ ] Verify Piston failure becomes a controlled application error.

> Do not assume the development Piston setup automatically exists on the production server.

---

# 11. Deployment Architecture Decision

Before deployment, explicitly choose:

```text
Frontend
   ↓
Production Backend/API
   ↓
Database
   ├── Piston execution service
   └── AI provider
         └── Ollama (if self-hosted)
```

- [ ] Choose frontend hosting.
- [ ] Choose backend hosting.
- [ ] Choose database hosting.
- [ ] Choose Piston hosting.
- [ ] Decide whether Ollama runs on the same server or separately.
- [ ] Configure DNS/domain.
- [ ] Configure HTTPS.
- [ ] Configure environment variables.
- [ ] Configure process/container restart policy.
- [ ] Configure logs.
- [ ] Configure basic health checks.

---

# 12. Deployment Procedure

## Backend

- [ ] Clone/build production version.
- [ ] Install production dependencies.
- [ ] Configure environment.
- [ ] Run database migrations.
- [ ] Start backend in production mode.
- [ ] Verify health endpoint.
- [ ] Verify logs contain no startup errors.

## Piston

- [ ] Deploy/start Piston.
- [ ] Verify all language runtimes.
- [ ] Run a test execution from the backend.

## AI

- [ ] Start Ollama if using local AI.
- [ ] Confirm `ollama list`.
- [ ] Confirm required model exists.
- [ ] Test model directly.
- [ ] Test CodeSync AI Review.
- [ ] Test CodeSync AI Hint.
- [ ] Test CodeSync Recommendations.

## Frontend

- [ ] Build production frontend.
- [ ] Deploy generated assets.
- [ ] Configure production API URL.
- [ ] Open deployed site.
- [ ] Verify authentication.
- [ ] Verify dashboard.
- [ ] Verify workspace.
- [ ] Verify submissions.
- [ ] Verify AI.

---

# 13. Production Smoke Test

Perform this immediately after deployment:

1. [ ] Open production URL.
2. [ ] Register/login.
3. [ ] Open Two Sum.
4. [ ] Edit code.
5. [ ] Save.
6. [ ] Refresh.
7. [ ] Confirm code remains.
8. [ ] Run C++.
9. [ ] Submit C++.
10. [ ] Run Python.
11. [ ] Submit Python.
12. [ ] Run JavaScript.
13. [ ] Submit JavaScript.
14. [ ] Run Java.
15. [ ] Submit Java.
16. [ ] Open submission history.
17. [ ] Request AI Review.
18. [ ] Request AI Hint.
19. [ ] Request AI Recommendations.
20. [ ] Create/join a Room if collaboration is MVP.
21. [ ] Test from a second browser/session.
22. [ ] Check browser console.
23. [ ] Check backend logs.
24. [ ] Confirm no secrets/internal stack traces are exposed.

---

# 14. Post-Deployment Monitoring

For the first deployment period:

- [ ] Monitor backend errors.
- [ ] Monitor Piston failures/timeouts.
- [ ] Monitor AI latency.
- [ ] Monitor Ollama memory usage if self-hosted.
- [ ] Monitor database errors.
- [ ] Monitor frontend console errors.
- [ ] Record C++ latency separately from other languages.
- [ ] Verify failed AI requests do not crash the backend.
- [ ] Verify users cannot see another user's data.

---

# 15. MVP Exit Criteria

CodeSync AI is ready to call **MVP-complete** when:

- [ ] Production frontend is deployed.
- [ ] Production backend is deployed.
- [ ] Production database is connected and migrated.
- [ ] Piston is reachable from production.
- [ ] All four languages execute correctly.
- [ ] Run + Submit work.
- [ ] Hidden tests remain private.
- [ ] Authentication/authorization work.
- [ ] Solo code persistence works.
- [ ] Rooms work if included in MVP scope.
- [ ] Local AI works if included in deployed MVP.
- [ ] AI failures degrade gracefully.
- [ ] Production HTTPS works.
- [ ] Security checklist has no unresolved critical item.
- [ ] Production smoke test passes.
- [ ] No known P0/P1 production bugs remain.

---

# 16. Explicitly Deferred After MVP

Do **not** block MVP on these unless requirements change:

- [ ] Further C++ GCC optimization.
- [ ] Precompiled headers for Piston.
- [ ] Advanced AI model benchmarking.
- [ ] Larger local models such as 20B/30B models.
- [ ] Advanced recommendation ranking.
- [ ] Advanced analytics.
- [ ] Extensive UI polish beyond production usability.
- [ ] Large-scale performance optimization.
- [ ] Complex observability infrastructure.
- [ ] Advanced collaboration features.

---

# Recommended Execution Order

```text
1. Production configuration
        ↓
2. Database + migrations
        ↓
3. Security/auth verification
        ↓
4. Piston deployment
        ↓
5. AI/Ollama deployment decision
        ↓
6. Backend production deployment
        ↓
7. Frontend production deployment
        ↓
8. Full production smoke test
        ↓
9. Fix deployment-only bugs
        ↓
10. MVP RELEASE
```

## MVP focus

**Finish → Deploy → Verify → Fix production blockers → Release.**

Avoid reopening already-verified Stage 11 architecture unless deployment testing produces concrete evidence of a defect.
