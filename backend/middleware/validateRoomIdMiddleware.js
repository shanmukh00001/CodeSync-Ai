const { validate: uuidValidate } = require("uuid");

// Validate the roomId from the URL
const validateRoomId = (req, res, next) => {
    // Get roomId from URL parameters
    const { roomId } = req.params;

    // Check that roomId is a non-empty string
    // Check that roomId is a valid UUID
    if (typeof roomId !== "string" || !uuidValidate(roomId)) {
        return res.status(400).json({
            message: "Invalid Room ID"
        });
    }

    // Continue to the next middleware or route
    next();
};

module.exports = validateRoomId;