const express = require("express");
const router = express.Router();//creates router object

const User = require("../models/User");
const Room = require("../models/Room");//getting the room model
const Problem = require("../models/Problem");


const protect = require("../middleware/authMiddleware");//protecting room routes
const checkRoomMember = require("../middleware/roomMemberMiddleware");
const validateRoomId = require("../middleware/validateRoomIdMiddleware");
const { v4: uuidv4, validate: uuidValidate } = require("uuid");
const { getIO } = require("../socket");

//create room
router.post("/create", protect, async (req, res) => {
  try {
        const { roomName, language } = req.body;

         // UPDATED: Validate roomName 
        if (typeof roomName !== "string" || !roomName.trim()) { 
            return res.status(400).json({ 
                message: "Room name must be a non-empty string" 
            }); 
        } 

        // UPDATED: Allowed programming languages 
        const allowedLanguages = ["javascript", "python", "java", "cpp"]; 

        // UPDATED: Validate language 
        if ( 
            typeof language !== "string" || 
            !allowedLanguages.includes(language) 
        ) { 
            return res.status(400).json({ 
                message: "Invalid programming language" 
            }); 
        } 

         // UPDATED: Find the currently logged-in user
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        if (user.activeRoom) {
            return res.status(400).json({
                message: "Leave your current room before creating a new room"
            });
        }
        const roomId = uuidv4();

        const room = await Room.create({
            roomId: roomId,
            roomName: roomName,
            createdBy: req.userId,
            users: [req.userId],
            language: language
        });
        // UPDATED: Set this newly created room as the user's active room and add to recentRooms
        user.activeRoom = roomId;
        if (!Array.isArray(user.recentRooms)) {
            user.recentRooms = [];
        }
        // Remove previous entry for this room if exists, then unshift new entry
        user.recentRooms = user.recentRooms.filter(
            (item) => item?.room && item.room.toString() !== room._id.toString()
        );
        user.recentRooms.unshift({
            room: room._id,
            joinedAt: new Date()
        });
        // Keep max 10 in history
        if (user.recentRooms.length > 10) {
            user.recentRooms = user.recentRooms.slice(0, 10);
        }
        await user.save();

        res.status(201).json({
            message: "Room created successfully",
            room: room
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});



//join room-> in db 
router.post("/join", protect, async (req, res) => {//req client to server what he needs,,res we send to client 
    try {
        // Get roomId sent by the user
        const { roomId } = req.body;

        // Check if roomId was provided
        // UPDATED: Validate roomId
        if (typeof roomId !== "string" || !uuidValidate(roomId)) {
            return res.status(400).json({
                message: "Invalid Room ID"
            });
        }
        // UPDATED: Find the currently logged-in user
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        // UPDATED: Check if the user is already in an active room
        if (user.activeRoom) {
            return res.status(400).json({
                message: "Leave your current room before joining another room"
            });
        }

        // Find the room using roomId
        const room = await Room.findOne({ roomId });

        // Check if the room exists
        if (!room) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        // Check if room is active
        if (room.status === "CLOSED") {
            return res.status(400).json({
                message: "Room is closed"
            });
        }

        // Check if the user is already in the room
       // Check if the user is already in the room
        const isMember = room.users.some(
            (userId) => userId.toString() === req.userId.toString()
        );

        if (isMember) {
            return res.status(400).json({
                message: "User is already in the room"
            });
        }

        // Check maximum room capacity
        if (room.users.length >= 3) {
            return res.status(400).json({
                message: "Room is full"
            });
        }


        // Add the user to the room
        room.users.push(req.userId);
        room.emptySince = null;

        // Save the updated room in MongoDB
        await room.save();
        // UPDATED: Set the joined room as the user's active room and add to recentRooms
        user.activeRoom = roomId;
        if (!Array.isArray(user.recentRooms)) {
            user.recentRooms = [];
        }
        user.recentRooms = user.recentRooms.filter(
            (item) => item?.room && item.room.toString() !== room._id.toString()
        );
        user.recentRooms.unshift({
            room: room._id,
            joinedAt: new Date()
        });
        if (user.recentRooms.length > 10) {
            user.recentRooms = user.recentRooms.slice(0, 10);
        }
        await user.save();

        // Emit participant:joined via Socket.IO only after successful DB updates
        const io = getIO();
        if (io) {
            io.to(roomId).emit("participant:joined", {
                roomId: room.roomId,
                users: room.users,
                participantsCount: room.users.length,
                joinedUserId: req.userId
            });
        }

        // Send success response
        res.status(200).json({
            message: "Joined room successfully",
            room: room
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

//entering to the room 
router.get("/:roomId", protect, validateRoomId , checkRoomMember,  async (req, res) => {//:roomId is a placeholder  ,as it should work for every room
    //try {
        // Get roomId from the URL
        //const { roomId } = req.params;
// If the frontend requests:
//GET http://localhost:5000/api/rooms/abc-123
//Then Express sees:router.get("/:roomId", ...)so,,,,req.params
        // Find the room in MongoDB
        try {
        // UPDATED: Get the room already found by roomMemberMiddleware
        const room = req.room;

        // Send the room data 
        res.status(200).json({ 
            room 
        }); 
 
    } catch (error) { 
        res.status(500).json({ 
            message: "Server error" 
        }); 
    } 
});

//saving the code written by client 
router.put("/:roomId", protect, validateRoomId,checkRoomMember, async (req, res) => {
    try {
       // Get the new code from the request body 
        const { code } = req.body; 
 
        // UPDATED: Get the room already found by roomMemberMiddleware
        const room = req.room;
        if (room.status === "CLOSED") {
            return res.status(400).json({
                message: "Room is closed"
            });
        }
        if (typeof code !== "string") { 
            return res.status(400).json({ 
                message: "Code must be a string" 
            }); 
        }
        // Update the code 
        room.code = code; 
        
        // Save the updated room 
        await room.save(); 
 
        // Send success response 
        res.status(200).json({ 
            message: "Code updated successfully", 
            room 
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

// Select/update problem for the room (Room Creator only)
router.put("/:roomId/problem", protect, validateRoomId, checkRoomMember, async (req, res) => {
    try {
        const { problemId } = req.body;
        const room = req.room;

        if (room.status === "CLOSED") {
            return res.status(400).json({
                message: "Room is closed"
            });
        }

        // Check if the authenticated user is the room creator/owner
        const isCreator = room.createdBy.toString() === req.userId.toString();
        if (!isCreator) {
            return res.status(403).json({
                message: "Only the room creator can select or change the problem"
            });
        }

        // Allow unselecting or setting problem
        if (!problemId) {
            room.selectedProblem = null;
            await room.save();
            return res.status(200).json({
                message: "Problem unselected successfully",
                room
            });
        }

        // Verify problemId is valid and problem exists
        const problem = await Problem.findById(problemId);
        if (!problem) {
            return res.status(404).json({
                message: "Problem not found"
            });
        }

        const language = room.language || "cpp";
        const starterCode =
            problem.starterCode && typeof problem.starterCode === "object"
                ? problem.starterCode[language] || problem.starterCode.cpp || ""
                : typeof problem.starterCode === "string"
                ? problem.starterCode
                : "";

        room.selectedProblem = problem._id;
        room.code = starterCode;
        await room.save();

        // Populate selectedProblem in response
        const updatedRoom = await Room.findOne({ roomId: room.roomId }).populate("selectedProblem");

        // Prepare sanitized problem representation (exclude hidden test cases)
        let sanitizedProblem = null;
        if (updatedRoom.selectedProblem) {
            const problemObj = typeof updatedRoom.selectedProblem.toObject === "function"
                ? updatedRoom.selectedProblem.toObject()
                : updatedRoom.selectedProblem;
            if (problemObj && Array.isArray(problemObj.testCases)) {
                problemObj.testCases = problemObj.testCases.filter((tc) => !tc.isHidden);
            }
            sanitizedProblem = problemObj;
        }

        // Emit problem:changed via Socket.IO only after DB save
        const io = getIO();
        if (io) {
            io.to(room.roomId).emit("problem:changed", {
                roomId: room.roomId,
                selectedProblem: sanitizedProblem,
                code: starterCode,
                language: room.language
            });
        }

        res.status(200).json({
            message: "Problem selected successfully",
            room: updatedRoom
        });

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

// leave room
router.post("/:roomId/leave", protect,validateRoomId, async (req, res) => {
    try {
        // Get roomId from the URL
        const { roomId } = req.params;

        // Find the currently logged-in user
        const user = await User.findById(req.userId);
        // UPDATED: Check if the user exists
        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }
        // Check if the user is actually in this room
        if (user.activeRoom !== roomId) {
            return res.status(400).json({
                message: "You are not currently in this room"
            });
        }

        // Find the room
        const room = await Room.findOne({ roomId });

        // Check if the room exists
        if (!room) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        // Remove the user from the room users array
        room.users = room.users.filter(
            (userId) => userId.toString() !== req.userId.toString()
        );

        // If participants remain, emptySince is null; if 0 participants, mark emptySince = new Date()
        if (room.users.length === 0) {
            room.emptySince = new Date();
        } else {
            room.emptySince = null;
        }

        // If the creator leaves but other users remain, transfer ownership to the first remaining user
        const isCreator = room.createdBy.toString() === req.userId.toString();
        if (isCreator && room.users.length > 0) {
            room.createdBy = room.users[0];
        }

        // Save the updated room (DO NOT delete the room document immediately)
        await room.save();

        // Remove the user's active room
        user.activeRoom = null;

        // Save the updated user (user.recentRooms remains intact)
        await user.save();

        // Emit participant:left via Socket.IO only after DB save
        const io = getIO();
        if (io) {
            io.to(roomId).emit("participant:left", {
                roomId: room.roomId,
                users: room.users,
                participantsCount: room.users.length,
                leftUserId: req.userId,
                newCreatedBy: room.createdBy
            });
        }

        // Send success response
        res.status(200).json({
            message: "Left room successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

// End room (Host/Creator only)
router.post("/:roomId/end", protect, validateRoomId, async (req, res) => {
    try {
        const { roomId } = req.params;

        const room = await Room.findOne({ roomId });
        if (!room) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        // Host authorization check
        const isHost = room.createdBy && room.createdBy.toString() === req.userId.toString();
        if (!isHost) {
            return res.status(403).json({
                message: "Only the room host can end the room"
            });
        }

        // Idempotent check: if already CLOSED, return safely
        if (room.status === "CLOSED") {
            return res.status(200).json({
                message: "Room is already ended",
                room
            });
        }

        // Update status to CLOSED and mark endedAt
        room.status = "CLOSED";
        room.endedAt = new Date();
        await room.save();

        // Clear activeRoom for all users who had this room active, preserving their recentRooms
        await User.updateMany(
            { activeRoom: roomId },
            { $set: { activeRoom: null } }
        );

        // Emit room:closed via Socket.IO
        const io = getIO();
        if (io) {
            io.to(roomId).emit("room:closed", {
                roomId: room.roomId,
                status: "CLOSED",
                endedAt: room.endedAt
            });
        }

        res.status(200).json({
            message: "Room ended successfully",
            room
        });
    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
});

module.exports=router;