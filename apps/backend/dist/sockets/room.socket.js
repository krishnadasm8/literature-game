"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attachRoomNamespace = void 0;
const jwt_1 = require("../utils/jwt");
const attachRoomNamespace = (namespace) => {
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
                socket.emit("room:error", { message: "Invalid auth token." });
            }
        }
        socketRooms.set(socket.id, new Set());
        socket.on("room:join", (payload) => {
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
        socket.on("room:leave", (payload) => {
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
            // Do not emit room:player_left on transient disconnects (e.g. refresh/reconnect).
            socketRooms.delete(socket.id);
        });
    });
};
exports.attachRoomNamespace = attachRoomNamespace;
