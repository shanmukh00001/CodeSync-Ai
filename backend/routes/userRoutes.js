const express=require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");


const router=express.Router();


//for register 
router.post("/register", async (req, res) => {
    try {
        const { name, email, password } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({
                message: "Name, email and password are required"
            });
        }
        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                message: "User already exists"
            });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({
            name,
            email,
            password: hashedPassword
        });

        await newUser.save();

        res.status(201).json({
            message: "User registration data received successfully",
            user: {
                name: name,
                email: email
            }
        });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});


//for login
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                message: "Email and password are required"
            });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({
                message: "Invalid email or password"
            });
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
        res.status(500).json({ message: "Server error" });
    }
});


// Logout
router.post("/logout", (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax"
    });

    res.status(200).json({
        message: "Logout successful"
    });
});



//me route
router.get("/me", protect, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        
        if (!user) {
            return res.status(404).json({ message: "User not found" });
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
        res.status(500).json({ message: "Server error" });
    }
});

// Update name
router.put("/name", protect, async (req, res) => {
    try {
        const { newName } = req.body;
        if (!newName || newName.trim() === "") {
            return res.status(400).json({ message: "Name cannot be empty" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (user.nameChanged) {
            return res.status(403).json({ message: "Name has already been changed once" });
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
        res.status(500).json({ message: "Server error" });
    }
});

// Update password
router.put("/password", protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: "Current and new passwords are required" });
        }

        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect current password" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        await user.save();

        res.status(200).json({ message: "Password updated successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
});

//profile route
router.get("/profile", protect, async (req, res) => {
//     //GET /profile
//       ↓
// protect middleware
//       ↓
// JWT valid?
//    ↙        ↘
//  NO         YES
//  ↓           ↓
// 401       next()
//              ↓
//        /profile route
    const user = await User.findById(req.userId);//verifying the decoded one with the db and sending to postman

    res.status(200).json({
        name: user.name,
        email: user.email
    });
});

module.exports = router;


