const Room = require("../models/Room");

// Check whether the logged-in user is a member of the room
const checkRoomMember = async (req, res, next) => {
    try {
        // Get roomId from the URL
        const { roomId } = req.params;

        // Find the room
        const room = await Room.findOne({ roomId })
            .populate("selectedProblem")
            .populate("users", "name email");

        // Check if the room exists
        if (!room) {
            return res.status(404).json({
                message: "Room not found"
            });
        }

        // Check if the logged-in user is a member of the room
        const isMember = room.users.some(
            (u) => (u?._id ? u._id.toString() : u.toString()) === req.userId.toString()
        );

        if (!isMember) {
            return res.status(403).json({
                message: "You are not a member of this room"
            });
        }

        // Store the room so the route can use it
        req.room = room;

        // Continue to the next middleware or route function
        next();

    } catch (error) {
        res.status(500).json({
            message: "Server error"
        });
    }
};

module.exports = checkRoomMember;