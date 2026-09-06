const DiscussionMessage = require("../models/DiscussionMessage");

/**
 * Idempotently saves or retrieves a discussion message scoped to (room, clientMessageId).
 * Safe against race conditions and concurrent requests via compound unique index.
 * 
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.roomId - MongoDB Room _id
 * @param {string|mongoose.Types.ObjectId} params.userId - Authenticated user _id
 * @param {string} params.message - Trimmed message text
 * @param {string} params.clientMessageId - Unique client message UUID
 * @returns {Promise<{ discussionMessage: Object, isNew: boolean }>}
 */
async function saveDiscussionMessageIdempotent({
  roomId,
  userId,
  message,
  clientMessageId,
}) {
  const query = { room: roomId, clientMessageId };

  // Check if message already exists
  const existing = await DiscussionMessage.findOne(query).populate(
    "user",
    "name email"
  );

  if (existing) {
    // Security check: ensure same clientMessageId wasn't claimed by another user
    const existingUserId = existing.user?._id || existing.user;
    if (existingUserId && existingUserId.toString() !== userId.toString()) {
      const error = new Error("clientMessageId already exists for a different user in this room");
      error.code = "CLIENT_MESSAGE_ID_CONFLICT";
      error.status = 403;
      throw error;
    }
    return { discussionMessage: existing, isNew: false };
  }

  try {
    const created = await DiscussionMessage.create({
      room: roomId,
      user: userId,
      message,
      clientMessageId,
    });

    const populated = await DiscussionMessage.findById(created._id).populate(
      "user",
      "name email"
    );

    return { discussionMessage: populated, isNew: true };
  } catch (error) {
    // Handle duplicate key error race condition (Mongo error code 11000)
    if (error.code === 11000) {
      const raceExisting = await DiscussionMessage.findOne(query).populate(
        "user",
        "name email"
      );

      if (raceExisting) {
        const raceUserId = raceExisting.user?._id || raceExisting.user;
        if (raceUserId && raceUserId.toString() !== userId.toString()) {
          const conflictError = new Error(
            "clientMessageId already exists for a different user in this room"
          );
          conflictError.code = "CLIENT_MESSAGE_ID_CONFLICT";
          conflictError.status = 403;
          throw conflictError;
        }
        return { discussionMessage: raceExisting, isNew: false };
      }
    }
    throw error;
  }
}

module.exports = {
  saveDiscussionMessageIdempotent,
};
