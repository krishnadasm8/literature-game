import type { Namespace } from "socket.io";
import { verifyToken } from "../utils/jwt";

export const attachGameNamespace = (namespace: Namespace): void => {
  const socketRooms = new Map<string, Set<string>>();

  namespace.on("connection", (socket) => {
    const rawToken = socket.handshake.auth?.token as string | undefined;
    let userId: string | null = null;

    if (rawToken) {
      try {
        const decoded = verifyToken(rawToken);
        userId = decoded.userId ?? decoded.sub ?? null;
      } catch {
        socket.emit("game:error", { message: "Invalid auth token." });
      }
    }

    socketRooms.set(socket.id, new Set<string>());

    socket.on("game:join", (payload: { roomCode?: string }) => {
      if (!userId) {
        socket.emit("game:error", { message: "Unauthorized socket." });
        return;
      }

      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        socket.emit("game:error", { message: "Missing room code." });
        return;
      }

      socket.join(roomCode);
      socketRooms.get(socket.id)?.add(roomCode);
    });

    socket.on("game:leave", (payload: { roomCode?: string }) => {
      const roomCode = payload?.roomCode?.toUpperCase();
      if (!roomCode) {
        return;
      }
      socket.leave(roomCode);
      socketRooms.get(socket.id)?.delete(roomCode);
    });

    socket.on("game:play_card", (_payload: unknown) => {
      // Stub handler.
    });

    socket.on("game:forfeit", (_payload: unknown) => {
      // Stub handler.
    });

    socket.on("game:sync", (_payload: unknown) => {
      // Stub handler.
    });

    socket.on("disconnect", () => {
      socketRooms.delete(socket.id);
    });
  });
};
