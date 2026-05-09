import { create } from "zustand";

import type { Card, GameState } from "@shared/src";

interface GameStoreState {
  gameState: GameState | null;
  myHand: Card[];
  setGameState: (gameState: GameState) => void;
  setMyHand: (cards: Card[]) => void;
  clearGame: () => void;
}

export const useGameStore = create<GameStoreState>((set) => ({
  gameState: null,
  myHand: [],
  setGameState: (gameState) => {
    set({ gameState });
  },
  setMyHand: (myHand) => {
    set({ myHand });
  },
  clearGame: () => {
    set({
      gameState: null,
      myHand: [],
    });
  },
}));
