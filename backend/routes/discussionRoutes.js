const express = require("express");
const router = express.Router();
const protect = require("../middleware/authMiddleware");
const validateRoomId = require("../middleware/validateRoomIdMiddleware");
const checkRoomMember = require("../middleware/roomMemberMiddleware");
const { AppError } = require("../middleware/errorMiddleware");
const DiscussionMessage = require("../models/DiscussionMessage");
const {
  saveDiscussionMessageIdempotent,
} = require("../services/discussionService");

// GET /api/discussions/:roomId
// Fetch latest discussion history for the room (oldest -> newest, max 100)
router.get(
  "/:roomId",
  protect,
  validateRoomId,
  checkRoomMember,
  async (req, res, next) => {
    try {
      const room = req.room;

      // Fetch the latest 100 messages sorted by createdAt asc
      const messages = await DiscussionMessage.find({ room: room._id })
        .sort({ createdAt: -1 })
        .limit(100)
        .populate("user", "name email");

      // Reverse so frontend gets oldest -> newest
      messages.reverse();

      res.status(200).json({
        messages,
      });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/discussions/:roomId
// Send and persist a new discussion message via REST idempotently
router.post(
  "/:roomId",
  protect,
  validateRoomId,
  checkRoomMember,
  async (req, res, next) => {
    try {
      const room = req.room;

      if (room.status === "CLOSED") {
        return next(
          new AppError(
            "Room is closed",
            400,
            "ROOM_CLOSED"
          )
        );
      }

      const { message, clientMessageId } = req.body;

      if (!message || typeof message !== "string" || !message.trim()) {
        return next(
          new AppError(
            "Message text is required and cannot be empty",
            400,
            "VALIDATION_ERROR"
          )
        );
      }

      if (
        !clientMessageId ||
        typeof clientMessageId !== "string" ||
        !clientMessageId.trim()
      ) {
        return next(
          new AppError(
            "clientMessageId is required and must be a valid non-empty string",
            400,
            "VALIDATION_ERROR"
          )
        );
      }

      const trimmedMsg = message.trim();
      if (trimmedMsg.length > 2000) {
        return next(
          new AppError(
            "Message exceeds the maximum length of 2000 characters",
            400,
            "VALIDATION_ERROR"
          )
        );
      }

      const trimmedClientId = clientMessageId.trim();
      if (trimmedClientId.length > 100) {
        return next(
          new AppError(
            "clientMessageId exceeds the maximum length of 100 characters",
            400,
            "VALIDATION_ERROR"
          )
        );
      }

      const { discussionMessage, isNew } =
        await saveDiscussionMessageIdempotent({
          roomId: room._id,
          userId: req.userId,
          message: trimmedMsg,
          clientMessageId: trimmedClientId,
        });

      res.status(isNew ? 201 : 200).json({
        message: isNew
          ? "Message sent successfully"
          : "Message already exists (idempotent)",
        discussionMessage,
      });
    } catch (error) {
      if (error.code === "CLIENT_MESSAGE_ID_CONFLICT") {
        return next(
          new AppError(
            "clientMessageId conflict: already used by another user in this room",
            403,
            "FORBIDDEN"
          )
        );
      }
      next(error);
    }
  }
);

module.exports = router;
