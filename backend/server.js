const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser= require("cookie-parser");
require("dotenv").config(); // Loads environment variables for CodeSync AI (SMTP/AI/Piston)


//express app
const app = express();

const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const oauthRoutes = require("./routes/oauthRoutes");
const adminProblemRoutes = require("./routes/adminProblemRoutes");
const roomRoutes = require("./routes/roomRoutes");
const problemRoutes = require("./routes/problemRoutes");
const submissionRoutes = require("./routes/submissionRoutes");
const discussionRoutes = require("./routes/discussionRoutes");
const errorMiddleware = require("./middleware/errorMiddleware");
//middleware

app.use(express.json());//allows user to send or read data
app.use(cookieParser());
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  process.env.CLIENT_URL,
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, postman) or matching allowed origins / local dev ports
      if (!origin || allowedOrigins.includes(origin) || /^http:\/\/localhost:\d+$/.test(origin) || /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

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
app.use("/api/auth", oauthRoutes);
app.use("/api/admin", adminProblemRoutes);
app.use("/api/users", userRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/problems", problemRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/discussions", discussionRoutes);
// Centralized error handler must be mounted LAST so it can catch errors
// forwarded from any route above (Stage 1.2 DoD, Section 10).
app.use(errorMiddleware);

//start server
const http = require("http");
const { initSocket } = require("./socket");
const { startRoomCleanupJob } = require("./services/roomCleanupService");

const server = http.createServer(app);
initSocket(server, allowedOrigins);

// Start periodic cleanup of abandoned rooms (runs every 60s, checks 10-min TTL)
startRoomCleanupJob();

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});