const express=require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const protect = require("../middleware/authMiddleware");
const User = require("../models/User");


const router=express.Router();


//for register 
router.post("/register", async (req, res) => {

    const { name, email, password } = req.body;
    // Check if all required fields exist
    if (!name || !email || !password) {
        return res.status(400).json({
            message: "Name, email and password are required"
        });
    }
    // Check if user already exists
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        return res.status(400).json({
            message: "User already exists"
        });
    }
    const hashedPassword = await bcrypt.hash(password, 10);//10//This is the salt rounds (cost factor).
    // Create a new user object
    const newUser = new User({
        name,
        email,
        password: hashedPassword
    });

    // Save the user to MongoDB
    await newUser.save();//This actually sends the data to MongoDB:

    res.status(201).json({
        message: "User registration data received successfully",
        user: {
            name: name,
            email: email
        }
    });

    console.log(name);
    console.log(email);
    console.log(password);

    
});


//for login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;

    // 1. Check if email and password are provided
    if (!email || !password) {
        return res.status(400).json({
            message: "Email and password are required"
        });
    }

    // 2. Find the user using email
    const user = await User.findOne({ email });

    // 3. Check whether the user exists
    if (!user) {
        return res.status(400).json({
            message: "Invalid email or password"
        });
    }

    // 4. Compare entered password with stored hashed password
    const isMatch = await bcrypt.compare(
        password,
        user.password
    );

    // 5. Check whether passwords match
    if (!isMatch) {
        return res.status(400).json({
            message: "Invalid email or password"
        });
    }
    //jwt authentication
    const token = jwt.sign(
    { userId: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
    );
    // 6. Login successful
    res.status(200).json({
        message: "Login successful",
        token:token,
        user: {
            name: user.name,
            email: user.email
        }
    });
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


