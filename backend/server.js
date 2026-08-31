const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();//Because we need to load the environment variables before we try to use them.


//express app
const app = express();

const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const roomRoutes = require("./routes/roomRoutes");
//middleware
app.use(express.json());//allows user to send or read data


//db-connection 
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB connected successfully");
    })
    .catch((error) => {
        console.log("MongoDB connection error:", error.message);
    });


//routes
app.get("/", (req, res) => {
    res.send("CodeSync AI Backend is running!");
});

app.use("/", testRoutes);
app.use("/api/users", userRoutes);
//app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);




//start server
app.listen(5000, () => {
    console.log("Server is running on port 5000");
});