import type { Player } from "./game.types";

export enum RoomStatus {
  WAITING = "WAITING",
  STARTING = "STARTING",
  IN_PROGRESS = "IN_PROGRESS",
  FINISHED = "FINISHED",
}

export interface RoomSettings {
  maxPlayers: 4 | 6 | 8;
  turnTimeoutSeconds: number;
}

export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  status: RoomStatus;
  maxPlayers: 4 | 6 | 8;
  players: Player[];
  settings: RoomSettings;
  createdAt: string;
}
