const express=require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");

const protect = require("../middleware/authMiddleware");
const validate = require("../middleware/validate");
const { authLimiter, registerLimiter } = require("../middleware/rateLimiters");
const { AppError } = require("../middleware/errorMiddleware");
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
            password: hashedPassword
        });

        await newUser.save();

        // Success response shape preserved (was { message, user: { name, email } }).
        res.status(201).json({
            message: "User registration data received successfully",
            user: {
                name: name,
                email: email
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

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return next(new AppError("Invalid email or password", 400, "INVALID_CREDENTIALS"));
        }

        const token = jwt.sign(
            { userId: user._id },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in ms
        });

        // Success response shape preserved.
        res.status(200).json({
            message: "Login successful",
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