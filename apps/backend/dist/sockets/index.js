"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToGameNamespace = exports.emitToRoomNamespace = exports.getSocketServer = exports.initializeSocketServer = void 0;
const socket_io_1 = require("socket.io");
const game_socket_1 = require("./game.socket");
const room_socket_1 = require("./room.socket");
let ioInstance = null;
let roomNamespaceInstance = null;
let gameNamespaceInstance = null;
const initializeSocketServer = (httpServer) => {
    const io = new socket_io_1.Server(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });
    roomNamespaceInstance = io.of("/room");
    (0, room_socket_1.attachRoomNamespace)(roomNamespaceInstance);
    gameNamespaceInstance = io.of("/game");
    (0, game_socket_1.attachGameNamespace)(gameNamespaceInstance);
    ioInstance = io;
    return io;
};
exports.initializeSocketServer = initializeSocketServer;
const getSocketServer = () => ioInstance;
exports.getSocketServer = getSocketServer;
const emitToRoomNamespace = (roomCode, event, payload) => {
    roomNamespaceInstance?.to(roomCode).emit(event, payload);
};
exports.emitToRoomNamespace = emitToRoomNamespace;
const emitToGameNamespace = (roomCode, event, payload) => {
    gameNamespaceInstance?.to(roomCode).emit(event, payload);
};
exports.emitToGameNamespace = emitToGameNamespace;
