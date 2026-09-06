const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Room = require("./models/Room");
const DiscussionMessage = require("./models/DiscussionMessage");
const {
  saveDiscussionMessageIdempotent,
} = require("./services/discussionService");

let ioInstance = null;

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader || typeof cookieHeader !== "string") return cookies;
  const items = cookieHeader.split(";");
  for (const item of items) {
    const [name, ...rest] = item.trim().split("=");
    if (name) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  }
  return cookies;
}

/**
 * Initialize Socket.IO with the existing HTTP server instance
 * @param {import("http").Server} httpServer
 * @param {Array<string>} allowedOrigins
 */
function initSocket(httpServer, allowedOrigins) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          /^http:\/\/localhost:\d+$/.test(origin) ||
          /^http:\/\/127\.0\.0\.1:\d+$/.test(origin)
        ) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
    },
    pingTimeout: 20000,
    pingInterval: 25000,
  });

  // Socket.IO JWT Authentication Middleware
  ioInstance.use((socket, next) => {
    try {
      const cookieHeader = socket.handshake.headers?.cookie;
      let token = null;

      if (cookieHeader) {
        const parsed = parseCookies(cookieHeader);
        token = parsed.token;
      }

      if (!token && socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      if (token) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
      } else {
        socket.userId = null;
      }
    } catch {
      socket.userId = null;
    }
    next();
  });

  ioInstance.on("connection", (socket) => {
    // Client joins a specific room channel using CodeSync roomId
    socket.on("room:join", ({ roomId }) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.join(roomId);
    });

    // Client leaves a specific room channel
    socket.on("room:leave", ({ roomId }) => {
      if (!roomId || typeof roomId !== "string") return;
      socket.leave(roomId);
    });

    // Client sends real-time code update
    socket.on("code:update", async (payload) => {
      try {
        if (!payload || typeof payload !== "object") return;
        const { roomId, code, timestamp } = payload;

        if (!roomId || typeof roomId !== "string") return;
        if (typeof code !== "string") return;
        if (!socket.userId) return;

        // Verify MongoDB room membership authoritatively
        const room = await Room.findOne({ roomId });
        if (!room || room.status === "CLOSED") return;

        const isMember = Array.isArray(room.users) && room.users.some(
          (userId) => userId && userId.toString() === socket.userId.toString()
        );

        if (!isMember) return;

        // Broadcast update ONLY to other connected sockets in the same room
        socket.to(roomId).emit("code:update", {
          roomId,
          code,
          senderId: socket.userId.toString(),
          timestamp: typeof timestamp === "number" ? timestamp : Date.now(),
        });
      } catch {
        // Prevent unhandled errors from affecting socket loop
      }
    });

    // Client sends a discussion message
    socket.on("discussion:send", async (payload, callback) => {
      try {
        if (!payload || typeof payload !== "object") return;
        const { roomId, message, clientMessageId } = payload;

        if (!roomId || typeof roomId !== "string") return;
        if (!message || typeof message !== "string" || !message.trim()) return;
        if (
          !clientMessageId ||
          typeof clientMessageId !== "string" ||
          !clientMessageId.trim()
        ) {
          return;
        }
        if (!socket.userId) return;

        const trimmed = message.trim();
        if (trimmed.length > 2000) return;

        const trimmedClientId = clientMessageId.trim();
        if (trimmedClientId.length > 100) return;

        // Verify MongoDB room membership authoritatively
        const room = await Room.findOne({ roomId });
        if (!room) {
          if (typeof callback === "function") {
            callback({ success: false, error: "Room not found" });
          }
          return;
        }

        if (room.status === "CLOSED") {
          if (typeof callback === "function") {
            callback({ success: false, error: "Room is closed" });
          }
          return;
        }

        const isMember = Array.isArray(room.users) && room.users.some(
          (userId) => userId && userId.toString() === socket.userId.toString()
        );

        if (!isMember) {
          if (typeof callback === "function") {
            callback({ success: false, error: "Not a room member" });
          }
          return;
        }

        // Persist message in MongoDB idempotently
        const { discussionMessage, isNew } =
          await saveDiscussionMessageIdempotent({
            roomId: room._id,
            userId: socket.userId,
            message: trimmed,
            clientMessageId: trimmedClientId,
          });

        // If newly created, broadcast to all sockets in the room
        if (isNew) {
          ioInstance.to(roomId).emit("discussion:message", {
            roomId,
            message: discussionMessage,
          });
        }

        if (typeof callback === "function") {
          callback({
            success: true,
            messageId: discussionMessage._id,
            isNew,
          });
        }
      } catch (err) {
        if (typeof callback === "function") {
          callback({
            success: false,
            error: err.message || "Failed to send message",
          });
        }
      }
    });

    socket.on("disconnect", () => {
      // Socket.IO disconnect is a transport event only.
      // Do NOT mutate MongoDB room membership or emit leave events here.
    });
  });

  return ioInstance;
}

/**
 * Access the initialized Socket.IO instance
 */
function getIO() {
  return ioInstance;
}

module.exports = {
  initSocket,
  getIO,
};

