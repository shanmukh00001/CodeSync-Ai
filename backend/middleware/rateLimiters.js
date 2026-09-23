// Rate limiters for authentication endpoints (Stage 1.2 / Section 10).
//
// Per architecture.md (Section 10, line 280):
//   "Rate limiting: register, login, forgot-password, and both execution endpoints"
// Only register and login are in scope for this Part 1 implementation.
//
// Why separate limiters:
//   - Register is more abuse-sensitive (account enumeration / spam signups).
//   - Login is more retry-tolerant (typos, caps lock, etc.).
//
// Defaults are conservative MVP values and can be tuned later.

const rateLimit = require("express-rate-limit");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 login attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            message: "Too many login attempts. Please try again later.",
            code: "RATE_LIMITED",
        },
    },
});

const registerLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 signup attempts per 15 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            message: "Too many registration attempts from this IP. Please try again later.",
            code: "RATE_LIMITED",
        },
    },
});

const otpLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // 5 OTP requests per 5 min per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: {
            message: "Too many OTP requests. Please wait a few minutes before trying again.",
            code: "RATE_LIMITED",
        },
    },
});

module.exports = {
    authLimiter,
    registerLimiter,
    otpLimiter,
};