import type { Card, HalfSuit } from "./card.types";

export enum GameStatus {
  WAITING = "WAITING",
  PLAYING = "PLAYING",
  FINISHED = "FINISHED",
}

export enum MoveType {
  ASK = "ASK",
  DECLARE = "DECLARE",
  FORFEIT = "FORFEIT",
}

export enum Team {
  TEAM_A = "TEAM_A",
  TEAM_B = "TEAM_B",
}

export interface Player {
  id: string;
  displayName: string;
  avatarUrl: string;
  team: Team;
  handCount: number;
  isBot: boolean;
  isConnected: boolean;
  coins?: number;
}

export interface Move {
  id: string;
  gameId: string;
  playerId: string;
  type: MoveType;
  card?: Card;
  targetPlayerId?: string;
  declaredSet?: HalfSuit;
  timestamp: string;
}

export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  currentTurnPlayerId: string;
  players: Player[];
  scores: Record<Team, number>;
  books: Record<Team, HalfSuit[]>;
  lastMove?: Move;
  round: number;
}
