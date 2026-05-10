import { create } from "zustand";

import type { Card, GameState } from "@shared/src";

interface AskResult {
  success: boolean;
  targetHadCard: boolean;
  card: Card;
  cardName: string;
  askingPlayerId: string;
  targetPlayerName: string;
  targetPlayerId: string;
  askingPlayerName: string;
  nextTurnPlayerId: string;
  isForMe: boolean;
}

interface DeclareResult {
  correct: boolean;
  halfSuit: string;
  winningTeam: string;
  declaringPlayerId: string;
  declaringPlayerName: string;
  ranOutOfCards: boolean;
  nextTurnPlayerId: string;
}

interface GameOverData {
  winner: string;
  teamABooks: number;
  teamBBooks: number;
  scores: Record<string, number>;
  gameStatus?: string;
}

interface GameStoreState {
  gameState: GameState | null;
  myHand: Card[];
  lastAskResult: AskResult | null;
  lastDeclareResult: DeclareResult | null;
  gameOverData: GameOverData | null;
  modalLocked: boolean;
  setGameState: (gameState: GameState) => void;
  setMyHand: (cards: Card[]) => void;
  setLastAskResult: (result: AskResult | null) => void;
  setLastDeclareResult: (result: DeclareResult | null) => void;
  setGameOver: (data: GameOverData | null) => void;
  setModalLocked: (locked: boolean) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: null,
  myHand: [],
  lastAskResult: null,
  lastDeclareResult: null,
  gameOverData: null,
  modalLocked: false,
  setGameState: (gameState) => {
    set({ gameState });
  },
  setMyHand: (myHand) => {
    set({ myHand });
  },
  setLastAskResult: (result) => {
    set((state) => {
      if (
        result &&
        state.lastAskResult?.askingPlayerId === result.askingPlayerId &&
        state.lastAskResult?.card?.rank === result.card?.rank &&
        state.lastAskResult?.card?.suit === result.card?.suit
      ) {
        return state;
      }
      return { lastAskResult: result };
    });
  },
  setLastDeclareResult: (lastDeclareResult) => {
    set({ lastDeclareResult });
  },
  setGameOver: (gameOverData) => {
    set({ gameOverData });
  },
  setModalLocked: (modalLocked) => {
    set({ modalLocked });
  },
  clearGame: () => {
    set({
      gameState: null,
      myHand: [],
      lastAskResult: null,
      lastDeclareResult: null,
      gameOverData: null,
      modalLocked: false,
    });
  },
}));
