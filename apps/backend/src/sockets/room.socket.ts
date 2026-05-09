import type { Namespace } from "socket.io";
import { verifyToken } from "../utils/jwt";

export const attachRoomNamespace = (namespace: Namespace): void => {
  const socketRooms = new Map<string, Set<string>>();

  namespace.on("connection", (socket) => {
    const rawToken = socket.handshake.auth?.token as string | undefined;
    let userId: string | null = null;

    if (rawToken) {
      try {
        const decoded = verifyToken(rawToken);
        userId = decoded.sub;
      } catch {
        socket.emit("room:error", { message: "Invalid auth token." });
      }
    }

    socketRooms.set(socket.id, new Set<string>());

    socket.on("room:join", (payload: { roomCode?: string }) => {
      if (!userId) {
        socket.emit("room:error", { message: "Unauthorized socket." });
        return;
      }

      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        socket.emit("room:error", { message: "Missing room code." });
        return;
      }

      socket.join(roomCode);
      socketRooms.get(socket.id)?.add(roomCode);
      socket.to(roomCode).emit("room:player_joined", {
        roomCode,
        playerId: userId,
      });
    });

    socket.on("room:leave", (payload: { roomCode?: string }) => {
      if (!userId) {
        socket.emit("room:error", { message: "Unauthorized socket." });
        return;
      }

      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        socket.emit("room:error", { message: "Missing room code." });
        return;
      }

      socket.leave(roomCode);
      socketRooms.get(socket.id)?.delete(roomCode);
      socket.to(roomCode).emit("room:player_left", {
        roomCode,
        playerId: userId,
      });
    });

    socket.on("disconnect", () => {
      const joinedRooms = socketRooms.get(socket.id) ?? new Set<string>();
      for (const roomCode of joinedRooms) {
        socket.to(roomCode).emit("room:player_left", {
          roomCode,
          playerId: userId,
        });
      }
      socketRooms.delete(socket.id);
    });
  });
};
