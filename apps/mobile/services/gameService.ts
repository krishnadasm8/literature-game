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

export const timeoutTurn = async (
  gameId: string,
): Promise<{ ok: boolean; currentTurnPlayerId: string; currentTurnPlayerName: string }> => {
  const result = await api.post<{ ok: boolean; currentTurnPlayerId: string; currentTurnPlayerName: string }>(
    `/games/${gameId}/timeout`,
  );
  return result.data;
};

export const declareSet = async (
  gameId: string,
  halfSuit: Card["halfSuit"],
): Promise<
  GameStateResponse & {
    ok: boolean;
    success: boolean;
    scoreDelta: number;
    declaringTeam: "TEAM_A" | "TEAM_B";
    newScore: number;
  }
> => {
  const result = await api.post<
    GameStateResponse & {
      ok: boolean;
      success: boolean;
      scoreDelta: number;
      declaringTeam: "TEAM_A" | "TEAM_B";
      newScore: number;
    }
  >(`/games/${gameId}/declare`, { halfSuit });
  return result.data;
};
