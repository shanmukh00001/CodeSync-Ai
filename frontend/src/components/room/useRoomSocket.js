import { useEffect, useRef } from "react";
import { io } from "socket.io-client";

export function useRoomSocket({
  roomId,
  user,
  onParticipantJoined,
  onParticipantLeft,
  onRoomClosed,
  onCodeUpdate,
  onCursorUpdate,
  onDiscussionMessage,
  onProblemChanged,
  onReconnect,
}) {
  const socketRef = useRef(null);
  const lastReceivedUpdateTimestampRef = useRef(0);

  // Keep callback refs fresh
  const callbacksRef = useRef({});
  useEffect(() => {
    callbacksRef.current = {
      onParticipantJoined,
      onParticipantLeft,
      onRoomClosed,
      onCodeUpdate,
      onCursorUpdate,
      onDiscussionMessage,
      onProblemChanged,
      onReconnect,
    };
  }, [
    onParticipantJoined,
    onParticipantLeft,
    onRoomClosed,
    onCodeUpdate,
    onCursorUpdate,
    onDiscussionMessage,
    onProblemChanged,
    onReconnect,
  ]);

  useEffect(() => {
    if (!roomId) return;

    const socket = io("http://localhost:5000", {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("room:join", { roomId });
      if (callbacksRef.current.onReconnect) {
        callbacksRef.current.onReconnect();
      }
    });

    socket.on("participant:joined", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      callbacksRef.current.onParticipantJoined?.(payload);
    });

    socket.on("participant:left", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      callbacksRef.current.onParticipantLeft?.(payload);
    });

    socket.on("room:closed", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      callbacksRef.current.onRoomClosed?.(payload);
    });

    socket.on("code:update", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      if (typeof payload.code !== "string") return;

      const myId = user?.id || user?._id;
      if (payload.senderId && myId && String(payload.senderId) === String(myId)) {
        return;
      }

      if (payload.timestamp && payload.timestamp < lastReceivedUpdateTimestampRef.current) {
        return;
      }
      if (payload.timestamp) {
        lastReceivedUpdateTimestampRef.current = payload.timestamp;
      }

      callbacksRef.current.onCodeUpdate?.(payload);
    });

    socket.on("cursor:update", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      const myId = user?.id || user?._id;
      if (payload.senderId && myId && String(payload.senderId) === String(myId)) {
        return;
      }
      callbacksRef.current.onCursorUpdate?.(payload);
    });

    socket.on("discussion:message", (payload) => {
      if (!payload || payload.roomId !== roomId || !payload.message) return;
      callbacksRef.current.onDiscussionMessage?.(payload);
    });

    socket.on("problem:changed", (payload) => {
      if (!payload || payload.roomId !== roomId) return;
      callbacksRef.current.onProblemChanged?.(payload);
    });

    return () => {
      socket.emit("room:leave", { roomId });
      socket.off("connect");
      socket.off("participant:joined");
      socket.off("participant:left");
      socket.off("room:closed");
      socket.off("code:update");
      socket.off("cursor:update");
      socket.off("discussion:message");
      socket.off("problem:changed");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomId, user]);

  const emitCodeUpdate = (code) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("code:update", {
        roomId,
        code,
        timestamp: Date.now(),
      });
    }
  };

  const emitCursorUpdate = (position) => {
    if (socketRef.current && socketRef.current.connected) {
      const uid = user?.id || user?._id || "user";
      const colors = ["#00d2ff", "#a855f7", "#ff9f43", "#10b981", "#ff6b81", "#54a0ff"];
      let hash = 0;
      for (let i = 0; i < String(uid).length; i++) {
        hash = (hash << 5) - hash + String(uid).charCodeAt(i);
        hash |= 0;
      }
      const color = colors[Math.abs(hash) % colors.length];

      socketRef.current.emit("cursor:update", {
        roomId,
        position,
        user: {
          id: uid,
          name: user?.name || user?.username || "Peer",
          color,
        },
      });
    }
  };

  const emitDiscussionSend = (payload, ackCallback) => {
    if (socketRef.current && socketRef.current.connected) {
      socketRef.current.emit("discussion:send", payload, ackCallback);
      return true;
    }
    return false;
  };

  return {
    socketRef,
    emitCodeUpdate,
    emitCursorUpdate,
    emitDiscussionSend,
  };
}
