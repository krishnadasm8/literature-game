import type { Server as HttpServer } from "node:http";
import { Server, type Namespace } from "socket.io";

import { attachGameNamespace } from "./game.socket";
import { attachRoomNamespace } from "./room.socket";

let ioInstance: Server | null = null;
let roomNamespaceInstance: Namespace | null = null;

export const initializeSocketServer = (httpServer: HttpServer): Server => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  roomNamespaceInstance = io.of("/room");
  attachRoomNamespace(roomNamespaceInstance);
  attachGameNamespace(io.of("/game"));
  ioInstance = io;

  return io;
};

export const getSocketServer = (): Server | null => ioInstance;

export const emitToRoomNamespace = (roomCode: string, event: string, payload: unknown): void => {
  roomNamespaceInstance?.to(roomCode).emit(event, payload);
};
