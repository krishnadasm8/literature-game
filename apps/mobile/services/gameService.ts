import type { Card, GameState } from "@shared/src";

import { api } from "./api";

export interface GameStateResponse {
  gameState: GameState;
  myHand?: Card[];
}

export const getGameState = async (gameId: string): Promise<GameStateResponse> => {
  const response = await api.get<GameStateResponse>(`/games/${gameId}`);
  return response.data;
};

export const playCard = async (
  gameId: string,
  payload: { targetPlayerId: string; card: Card },
): Promise<void> => {
  await api.post(`/games/${gameId}/move`, payload);
};

export const forfeit = async (gameId: string): Promise<void> => {
  await api.post(`/games/${gameId}/forfeit`);
};

export const respondToAsk = async (
  gameId: string,
  response: "GIVE" | "NO",
): Promise<GameStateResponse> => {
  const result = await api.post<GameStateResponse>(`/games/${gameId}/respond`, {
    response,
  });
  return result.data;
};
