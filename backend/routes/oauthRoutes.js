const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { z } = require("zod");
const User = require("../models/User");
const validate = require("../middleware/validate");
const { authLimiter } = require("../middleware/rateLimiters");
const { AppError } = require("../middleware/errorMiddleware");

const router = express.Router();

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID || "mock-client-id"
);

const googleAuthSchema = z.object({
    credential: z.string().min(1, "Google credential token is required"),
});

/**
 * POST /api/auth/google
 * Receives the Google ID token (credential) from Google Identity Services on the frontend,
 * verifies it with Google, finds or provisions the User, and issues an HttpOnly JWT cookie.
 */
router.post("/google", authLimiter, validate(googleAuthSchema), async (req, res, next) => {
    try {
        const { credential } = req.body;

        let payload = null;

        // In production/when CLIENT_ID is configured, verify token with Google
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID !== "mock-client-id") {
            const ticket = await client.verifyIdToken({
                idToken: credential,
                audience: process.env.GOOGLE_CLIENT_ID,
            });
            payload = ticket.getPayload();
        } else {
            // Mock decoder for dev/testing when test token is supplied
            try {
                // If JWT payload can be decoded safely
                const base64Url = credential.split(".")[1];
                if (base64Url) {
                    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
                    const jsonPayload = decodeURIComponent(
                        Buffer.from(base64, "base64")
                            .toString()
                            .split("")
                            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
                            .join("")
                    );
                    payload = JSON.parse(jsonPayload);
                }
            } catch (err) {
                // Ignore decoding error, fallback below
            }

            if (!payload || !payload.email) {
                // Dev fallback simulated user if passed mock string
                payload = {
                    sub: "google-mock-id-" + Date.now(),
                    email: credential.includes("@") ? credential : "google.user@example.com",
                    name: "Google Developer",
                    email_verified: true,
                };
            }
        }

        if (!payload || !payload.email) {
            return next(new AppError("Invalid Google credential token", 400, "INVALID_GOOGLE_TOKEN"));
        }

        const { sub: googleId, email, name } = payload;

        let user = await User.findOne({
            $or: [{ googleId }, { email: email.toLowerCase() }]
        });

        if (user) {
            // Link googleId and mark email verified if not already
            if (!user.googleId) user.googleId = googleId;
            user.isEmailVerified = true;
            await user.save();
        } else {
            // Create new OAuth user
            user = new User({
                name: name || email.split("@")[0],
                email: email.toLowerCase(),
                authProvider: "google",
                googleId,
                role: "user",
                isEmailVerified: true,
            });
            await user.save();
        }

        // Issue 7-day session token
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
            message: "Google authentication successful",
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

module.exports = router;
