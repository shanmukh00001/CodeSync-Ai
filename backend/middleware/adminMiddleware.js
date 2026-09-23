const { AppError } = require("./errorMiddleware");
const User = require("../models/User");

/**
 * Middleware to enforce Admin / Superadmin Role Based Access Control
 */
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.userId) {
            return next(new AppError("Authentication required.", 401, "UNAUTHENTICATED"));
        }

        // Check if role was populated in JWT or fetch from DB to verify current status
        let role = req.userRole;
        if (!role || role === "user") {
            const user = await User.findById(req.userId).select("role");
            if (!user) {
                return next(new AppError("User account not found.", 404, "USER_NOT_FOUND"));
            }
            role = user.role;
        }

        if (role !== "admin" && role !== "superadmin") {
            return next(new AppError("Access denied. Admin privileges required.", 403, "FORBIDDEN_ADMIN_ONLY"));
        }

        next();
    } catch (error) {
        next(error);
    }
};

module.exports = requireAdmin;
