"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachGameNamespace = void 0;
const jwt_1 = require("../utils/jwt");
const attachGameNamespace = (namespace) => {
    const socketRooms = new Map();
    namespace.on("connection", (socket) => {
        const rawToken = socket.handshake.auth?.token;
        let userId = null;
        if (rawToken) {
            try {
                const decoded = (0, jwt_1.verifyToken)(rawToken);
                userId = decoded.userId ?? decoded.sub ?? null;
            }
            catch {
                socket.emit("game:error", { message: "Invalid auth token." });
            }
        }
        socketRooms.set(socket.id, new Set());
        socket.on("game:join", (payload) => {
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
        socket.on("game:leave", (payload) => {
            const roomCode = payload?.roomCode?.toUpperCase();
            if (!roomCode) {
                return;
            }
            socket.leave(roomCode);
            socketRooms.get(socket.id)?.delete(roomCode);
        });
        socket.on("game:play_card", (_payload) => {
            // Stub handler.
        });
        socket.on("game:forfeit", (_payload) => {
            // Stub handler.
        });
        socket.on("game:sync", (_payload) => {
            // Stub handler.
        });
        socket.on("disconnect", () => {
            socketRooms.delete(socket.id);
        });
    });
};
exports.attachGameNamespace = attachGameNamespace;
