const express = require("express");
const router = express.Router();//creates router object

const User = require("../models/User");
const Room = require("../models/Room");//getting the room model


const protect = require("../middleware/authMiddleware");//protecting room routes
const checkRoomMember = require("../middleware/roomMemberMiddleware");
const validateRoomId = require("../middleware/validateRoomIdMiddleware");
//const { v4: uuidv4 } = require("uuid");//unique identifier---->change it to validate by uuid 
const { v4: uuidv4, validate: uuidValidate } = require("uuid");

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
        // UPDATED: Set this newly created room as the user's active room
        user.activeRoom = roomId;
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

        // Check if the user is already in the room
        const isMember = room.users.some(
            (userId) => userId.toString() === req.userId.toString()
        );

        if (isMember) {
            return res.status(400).json({
                message: "User is already in the room"
            });
        }

        // Add the user to the room
        room.users.push(req.userId);

        // Save the updated room in MongoDB
        await room.save();
         // UPDATED: Set the joined room as the user's active room
        user.activeRoom = roomId;
        await user.save();
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
        // UPDATED: Check if the leaving user is the room creator
        const isCreator = room.createdBy.toString() === req.userId.toString();

        // Remove the user from the room users array
        room.users = room.users.filter(
            (userId) => userId.toString() !== req.userId.toString()
        );

        // UPDATED: If the creator leaves
        if (isCreator) {

            // If no users remain, delete the room
            if (room.users.length === 0) {
                await Room.deleteOne({ roomId });
            } else {
                // Transfer ownership to the first remaining user
                room.createdBy = room.users[0];

                // Save the updated room
                await room.save();
            }

        } else {
            // Normal member leaves, so just save the updated room
            await room.save();
        }

        // Remove the user's active room
        user.activeRoom = null;

        // Save the updated user
        await user.save();

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


module.exports=router;