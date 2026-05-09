import type { Card, GameState } from "@shared/src";

import { api } from "./api";

export const getGameState = async (gameId: string): Promise<GameState> => {
  const response = await api.get<GameState>(`/api/v1/games/${gameId}`);
  return response.data;
};

export const playCard = async (
  gameId: string,
  payload: { targetPlayerId: string; card: Card },
): Promise<void> => {
  await api.post(`/api/v1/games/${gameId}/move`, payload);
};

export const forfeit = async (gameId: string): Promise<void> => {
  await api.post(`/api/v1/games/${gameId}/forfeit`);
};
