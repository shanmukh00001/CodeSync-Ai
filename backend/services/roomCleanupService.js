const Room = require("../models/Room");
const DiscussionMessage = require("../models/DiscussionMessage");

/**
 * Runs cleanup of abandoned rooms that have been empty for longer than ROOM_EMPTY_TTL_MINUTES.
 * Deletes the room documents and all associated discussion messages atomically/safely.
 */
async function cleanupAbandonedRooms() {
  try {
    const ttlMinutes = parseInt(process.env.ROOM_EMPTY_TTL_MINUTES, 10) || 10;
    const expirationThreshold = new Date(Date.now() - ttlMinutes * 60 * 1000);

    // 1. Find ACTIVE rooms that have 0 participants and have been empty longer than the TTL
    // 2. Find CLOSED rooms whose endedAt is older than the TTL
    const roomsToClean = await Room.find({
      $or: [
        {
          status: "ACTIVE",
          users: { $size: 0 },
          emptySince: { $ne: null, $lte: expirationThreshold },
        },
        {
          status: "CLOSED",
          endedAt: { $ne: null, $lte: expirationThreshold },
        },
      ],
    }).select("_id roomId status");

    if (!roomsToClean || roomsToClean.length === 0) {
      return { deletedCount: 0 };
    }

    const roomIdsToDelete = roomsToClean.map((r) => r._id);

    // Delete associated discussion messages for all rooms being cleaned up
    const deletedMessagesResult = await DiscussionMessage.deleteMany({
      room: { $in: roomIdsToDelete },
    });

    // Delete the rooms matching the expiration criteria
    const deleteResult = await Room.deleteMany({
      _id: { $in: roomIdsToDelete },
    });

    if (deleteResult.deletedCount > 0) {
      console.log(
        `[RoomCleanupJob] Permanently cleaned up ${deleteResult.deletedCount} room(s) and ${deletedMessagesResult.deletedCount} discussion messages.`
      );
    }

    return { deletedCount: deleteResult.deletedCount };
  } catch (error) {
    console.error("[RoomCleanupJob] Error during room cleanup:", error.message);
    return { error };
  }
}

let cleanupIntervalHandle = null;

/**
 * Starts periodic cleanup timer (default: every 60 seconds)
 */
function startRoomCleanupJob(intervalMs = 60000) {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
  }

  // Run initial cleanup check immediately on startup
  cleanupAbandonedRooms();

  // Schedule recurring check
  cleanupIntervalHandle = setInterval(cleanupAbandonedRooms, intervalMs);
  return cleanupIntervalHandle;
}

/**
 * Stops periodic cleanup timer
 */
function stopRoomCleanupJob() {
  if (cleanupIntervalHandle) {
    clearInterval(cleanupIntervalHandle);
    cleanupIntervalHandle = null;
  }
}

module.exports = {
  cleanupAbandonedRooms,
  startRoomCleanupJob,
  stopRoomCleanupJob,
};
