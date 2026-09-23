const express=require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const protect = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { authLimiter, registerLimiter, otpLimiter } = require("../middleware/rateLimiters");
const { AppError } = require("../middleware/errorMiddleware");
const { issueUserOtp, verifyUserOtp } = require("../services/otpService");
const User = require("../models/User");
const Room = require("../models/Room");


const router=express.Router();


// Zod schemas for route-boundary validation (Stage 1.2 DoD).
const registerSchema = z.object({
    name: z.string().trim().min(1, "Name is required").max(50, "Name is too long"),
    email: z.string().trim().toLowerCase().email("Invalid email"),
    password: z.string().min(8, "Password must be at least 8 characters"),
});

const loginSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email"),
    password: z.string().min(1, "Password is required"),
});

const sendOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email"),
    purpose: z.enum(["verification", "login", "reset_password"]).default("verification"),
});

const verifyOtpSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email"),
    otp: z.string().trim().length(6, "OTP must be exactly 6 digits"),
    purpose: z.enum(["verification", "login", "reset_password"]).default("verification"),
});

const resetPasswordSchema = z.object({
    email: z.string().trim().toLowerCase().email("Invalid email"),
    otp: z.string().trim().length(6, "OTP must be exactly 6 digits"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
});


//for register
router.post("/register", registerLimiter, validate(registerSchema), async (req, res, next) => {
    try {
        const { name, email, password } = req.body;

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            // Use AppError so the centralized handler returns the
            // architecture-required { error: { message, code } } shape.
            return next(new AppError("User already exists", 400, "USER_EXISTS"));
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: "user",
            isEmailVerified: false,
            authProvider: "local",
        });

        await newUser.save();

        // Issue initial verification OTP
        await issueUserOtp(newUser, "verification");

        res.status(201).json({
            message: "User registered successfully. A 6-digit verification code has been sent to your email.",
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role,
                isEmailVerified: newUser.isEmailVerified,
            }
        });
    } catch (error) {
        next(error);
    }
});


//for login
router.post("/login", authLimiter, validate(loginSchema), async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return next(new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS"));
        }

        if (user.authProvider === "google" && !user.password) {
            return next(new AppError("This account uses Google Sign-In. Please sign in with Google.", 400, "USE_GOOGLE_AUTH"));
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return next(new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS"));
        }

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
        });

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                authProvider: user.authProvider,
                activeRoom: user.activeRoom,
                createdAt: user.createdAt,
                nameChanged: user.nameChanged
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/send-otp (Send OTP for verification, passwordless login, or password reset)
router.post("/send-otp", otpLimiter, validate(sendOtpSchema), async (req, res, next) => {
    try {
        const { email, purpose } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            // For password reset or login, don't expose user existence directly, but return error
            if (purpose === "login" || purpose === "reset_password") {
                return next(new AppError("No account found with this email address.", 404, "USER_NOT_FOUND"));
            }
            return next(new AppError("User not found.", 404, "USER_NOT_FOUND"));
        }

        await issueUserOtp(user, purpose);

        res.status(200).json({
            success: true,
            message: `A 6-digit verification code has been sent to ${email}.`,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/verify-otp (Verify OTP for email verification or passwordless login)
router.post("/verify-otp", authLimiter, validate(verifyOtpSchema), async (req, res, next) => {
    try {
        const { email, otp, purpose } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return next(new AppError("User not found.", 404, "USER_NOT_FOUND"));
        }

        const verificationResult = await verifyUserOtp(user, otp, purpose);

        if (!verificationResult.valid) {
            return next(new AppError(verificationResult.message, 400, verificationResult.error));
        }

        // Issue JWT token on successful verification or passwordless login
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            success: true,
            message: verificationResult.message,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isEmailVerified: user.isEmailVerified,
                authProvider: user.authProvider,
                activeRoom: user.activeRoom,
                createdAt: user.createdAt,
                nameChanged: user.nameChanged,
            }
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/forgot-password
router.post("/forgot-password", otpLimiter, validate(sendOtpSchema), async (req, res, next) => {
    try {
        const { email } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return next(new AppError("No account found with this email address.", 404, "USER_NOT_FOUND"));
        }

        await issueUserOtp(user, "reset_password");

        res.status(200).json({
            success: true,
            message: `Password reset OTP has been sent to ${email}.`,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/users/reset-password
router.post("/reset-password", authLimiter, validate(resetPasswordSchema), async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return next(new AppError("User not found.", 404, "USER_NOT_FOUND"));
        }

        const verificationResult = await verifyUserOtp(user, otp, "reset_password");

        if (!verificationResult.valid) {
            return next(new AppError(verificationResult.message, 400, verificationResult.error));
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.isEmailVerified = true; // password reset verifies email
        await user.save();

        res.status(200).json({
            success: true,
            message: "Password reset successful. You can now login with your new password.",
        });
    } catch (error) {
        next(error);
    }
});


// Logout
router.post("/logout", (req, res, next) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax"
        });

        res.status(200).json({
            message: "Logout successful"
        });
    } catch (error) {
        next(error);
    }
});



//me route
router.get("/me", protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        res.status(200).json({
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role || "user",
            isEmailVerified: !!user.isEmailVerified,
            authProvider: user.authProvider || "local",
            activeRoom: user.activeRoom,
            createdAt: user.createdAt,
            nameChanged: user.nameChanged
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/recent-rooms - returns top 2 recently joined rooms
router.get("/recent-rooms", protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).populate({
            path: "recentRooms.room",
            select: "roomId roomName language users createdBy status"
        });

        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        const recentList = Array.isArray(user.recentRooms) ? user.recentRooms : [];

        // Filter out any entries where the room document was deleted/null, sort by joinedAt desc, slice top 2
        const validRecent = recentList
            .filter((item) => item?.room && item.room._id)
            .sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt))
            .slice(0, 2)
            .map((item) => ({
                roomId: item.room.roomId,
                roomName: item.room.roomName,
                language: item.room.language,
                status: item.room.status || "ACTIVE",
                userCount: Array.isArray(item.room.users) ? item.room.users.length : 1,
                joinedAt: item.joinedAt
            }));

        res.status(200).json({
            recentRooms: validRecent
        });
    } catch (error) {
        next(error);
    }
});

// Update name
router.put("/name", protect, async (req, res, next) => {
    try {
        const { newName } = req.body;
        if (!newName || newName.trim() === "") {
            return next(new AppError("Name cannot be empty", 400, "INVALID_NAME"));
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        if (user.nameChanged) {
            return next(new AppError("Name has already been changed once", 403, "NAME_ALREADY_CHANGED"));
        }

        user.name = newName.trim();
        user.nameChanged = true;
        await user.save();

        res.status(200).json({
            message: "Name updated successfully",
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                activeRoom: user.activeRoom,
                createdAt: user.createdAt,
                nameChanged: user.nameChanged
            }
        });
    } catch (error) {
        next(error);
    }
});

// Update password
router.put("/password", protect, async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return next(new AppError("Current and new passwords are required", 400, "INVALID_PASSWORD_INPUT"));
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return next(new AppError("Incorrect current password", 400, "INVALID_CURRENT_PASSWORD"));
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/solved-problems - returns the authenticated user's solved problems
router.get("/solved-problems", protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId).populate({
            path: "solvedProblems.problem",
            select: "_id title slug difficulty tags"
        });

        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        const rawList = Array.isArray(user.solvedProblems) ? user.solvedProblems : [];

        // Filter out any entries where the Problem document was deleted/null, sort by solvedAt desc
        const validSolved = rawList
            .filter((item) => item?.problem && item.problem._id)
            .sort((a, b) => new Date(b.solvedAt || 0) - new Date(a.solvedAt || 0))
            .map((item) => ({
                _id: item.problem._id,
                title: item.problem.title,
                slug: item.problem.slug,
                difficulty: item.problem.difficulty,
                tags: item.problem.tags || [],
                solvedAt: item.solvedAt
            }));

        // Calculate statistics for profile cards
        const stats = {
            totalSolved: validSolved.length,
            easy: validSolved.filter((p) => p.difficulty === "Easy").length,
            medium: validSolved.filter((p) => p.difficulty === "Medium").length,
            hard: validSolved.filter((p) => p.difficulty === "Hard").length,
        };

        res.status(200).json({
            solvedProblems: validSolved,
            stats
        });
    } catch (error) {
        next(error);
    }
});

const { getUserAnalytics } = require("../services/analyticsService");
const { getRecommendations } = require("../services/recommendationService");
const rateLimit = require("express-rate-limit");

// Per-user recommendation rate limiter (10 requests per minute)
const recommendationLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    skipFailedRequests: true,
    validate: {
        keyGeneratorIpFallback: false,
    },
    keyGenerator: (req) => {
        return req.userId ? String(req.userId) : req.ip;
    },
    handler: (req, res, next) => {
        next(
            new AppError(
                "Recommendation rate limit reached. Please wait a minute before requesting again.",
                429,
                "RATE_LIMIT_EXCEEDED"
            )
        );
    },
});

// GET /api/users/recommendations - returns authenticated user's personalized coding recommendations
router.get("/recommendations", protect, recommendationLimiter, async (req, res, next) => {
    try {
        const data = await getRecommendations(req.userId);
        res.status(200).json({
            success: true,
            data,
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/users/analytics - returns the authenticated user's personal analytics
router.get("/analytics", protect, async (req, res, next) => {
    try {
        const analytics = await getUserAnalytics(req.userId);
        res.status(200).json({
            success: true,
            analytics,
        });
    } catch (error) {
        next(error);
    }
});

//profile route
router.get("/profile", protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.userId);

        if (!user) {
            return next(new AppError("User not found", 404, "USER_NOT_FOUND"));
        }

        res.status(200).json({
            name: user.name,
            email: user.email
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;