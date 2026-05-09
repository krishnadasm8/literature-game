import type { Card, HalfSuit } from "./card.types";
import type { GameState, Move, Player, Team } from "./game.types";
import type { Room, RoomSettings } from "./room.types";

export const SOCKET_EVENTS = {
  ROOM_JOIN: "ROOM_JOIN",
  ROOM_LEAVE: "ROOM_LEAVE",
  ROOM_PLAYER_JOINED: "ROOM_PLAYER_JOINED",
  ROOM_PLAYER_LEFT: "ROOM_PLAYER_LEFT",
  ROOM_PLAYER_READY: "ROOM_PLAYER_READY",
  ROOM_GAME_STARTING: "ROOM_GAME_STARTING",
  GAME_STATE_UPDATE: "GAME_STATE_UPDATE",
  GAME_TURN_CHANGED: "GAME_TURN_CHANGED",
  GAME_MOVE_PLAYED: "GAME_MOVE_PLAYED",
  GAME_ROUND_END: "GAME_ROUND_END",
  GAME_OVER: "GAME_OVER",
  GAME_ERROR: "GAME_ERROR",
  GAME_SYNC: "GAME_SYNC",
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];

export type RoomJoinPayload = {
  roomCode: string;
  playerId: string;
};

export type RoomLeavePayload = {
  roomCode: string;
  playerId: string;
};

export type RoomPlayerJoinedPayload = {
  roomId: string;
  player: Player;
};

export type RoomPlayerLeftPayload = {
  roomId: string;
  playerId: string;
};

export type RoomPlayerReadyPayload = {
  roomId: string;
  playerId: string;
  isReady: boolean;
};

export type RoomGameStartingPayload = {
  roomId: string;
  settings: RoomSettings;
  countdownSeconds: number;
};

export type GameStateUpdatePayload = {
  gameId: string;
  state: GameState;
};

export type GameTurnChangedPayload = {
  gameId: string;
  currentTurnPlayerId: string;
};

export type GameMovePlayedPayload = {
  gameId: string;
  move: Move;
};

export type GameRoundEndPayload = {
  gameId: string;
  round: number;
  booksClaimed: HalfSuit[];
};

export type GameOverPayload = {
  gameId: string;
  winnerTeam: Team;
  finalState: GameState;
};

export type GameErrorPayload = {
  gameId?: string;
  code: string;
  message: string;
};

export type GameSyncPayload = {
  room: Room;
  gameState: GameState;
  hand?: Card[];
};

export type SocketPayloads = {
  [SOCKET_EVENTS.ROOM_JOIN]: RoomJoinPayload;
  [SOCKET_EVENTS.ROOM_LEAVE]: RoomLeavePayload;
  [SOCKET_EVENTS.ROOM_PLAYER_JOINED]: RoomPlayerJoinedPayload;
  [SOCKET_EVENTS.ROOM_PLAYER_LEFT]: RoomPlayerLeftPayload;
  [SOCKET_EVENTS.ROOM_PLAYER_READY]: RoomPlayerReadyPayload;
  [SOCKET_EVENTS.ROOM_GAME_STARTING]: RoomGameStartingPayload;
  [SOCKET_EVENTS.GAME_STATE_UPDATE]: GameStateUpdatePayload;
  [SOCKET_EVENTS.GAME_TURN_CHANGED]: GameTurnChangedPayload;
  [SOCKET_EVENTS.GAME_MOVE_PLAYED]: GameMovePlayedPayload;
  [SOCKET_EVENTS.GAME_ROUND_END]: GameRoundEndPayload;
  [SOCKET_EVENTS.GAME_OVER]: GameOverPayload;
  [SOCKET_EVENTS.GAME_ERROR]: GameErrorPayload;
  [SOCKET_EVENTS.GAME_SYNC]: GameSyncPayload;
};
