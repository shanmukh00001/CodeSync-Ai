// Centralized error-handling middleware.
//
// Architecture (Section 10) requires errors to follow the shape:
//   { error: { message, code } }
//
// Usage:
//   - Routes `next(err)` instead of writing their own 500 JSON.
//   - The validate() helper forwards ZodError here with name="ZodError".
//   - Anywhere in the stack, throw or call next with an AppError to set
//     a specific status + code.

class AppError extends Error {
    constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
    }
}

const errorMiddleware = (err, req, res, next) => {
    // Default values for anything not set on the error.
    let statusCode = err.statusCode || 500;
    let code = err.code || "INTERNAL_ERROR";
    let message = err.message || "Server error";
    let details;

    // Zod validation failures are routed here by middleware/validate.js.
    if (err.name === "ZodError") {
        statusCode = 400;
        code = "VALIDATION_ERROR";
        message = "Invalid request payload";
        details = err.flatten ? err.flatten() : undefined;
    }

    // Log full error server-side for debugging (includes stack).
    console.error(
        `[error] ${req.method} ${req.originalUrl} -> ${statusCode} ${code}: ${message}`
    );
    if (err.stack) {
        console.error(err.stack);
    }

    const body = {
        error: {
            message,
            code,
        },
    };

    // Include validation details only in development to avoid leaking shape info.
    if (details && process.env.NODE_ENV !== "production") {
        body.error.details = details;
    }

    res.status(statusCode).json(body);
};

module.exports = errorMiddleware;
module.exports.AppError = AppError;