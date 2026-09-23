# Project Roadmap & Autonomous Backlog

## Milestone 1: Core Foundation
- [x] Task 1.1: Project initialization and environment verification
- [x] Task 1.2: Implement core service models and schemas
- [x] Task 1.3: Write automated unit tests for core models

## Milestone 2: Core Feature Implementation
- [x] Task 2.1: Implement main business logic endpoints/handlers
- [x] Task 2.2: Add validation, error handling, and logging
- [x] Task 2.3: Add integration tests and verify full test suite passes

## Milestone 3: Admin Portal, Email OTP Verification & Google OAuth
- [x] Task 3.1: Install backend dependencies (nodemailer) and update User model with role, email verification, and OTP secrets
- [x] Task 3.2: Implement Email & OTP Service (nodemailer, crypto generator, dark/orange templates, rate limiting)
- [x] Task 3.3: Implement Backend Auth Endpoints (send-otp, verify-otp, forgot-password, reset-password, Google OAuth)
- [x] Task 3.4: Implement Admin RBAC Middleware & Admin Problem Management CRUD APIs with sandbox validation
- [x] Task 3.5: Implement Frontend Auth UI (Google OAuth button, Login with Email OTP, Register OTP flow)
- [x] Task 3.6: Implement Frontend Admin Portal (Admin Dashboard & Rich Problem Editor with Test Case Builder & Markdown Preview)
- [x] Task 3.7: Automated verification, test suite execution, and comprehensive report generation
