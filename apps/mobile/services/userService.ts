import { api } from "./api";

export type CurrentUserResponse = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  avatarPreset: number | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  coins: number;
};

export const fetchCurrentUser = async (): Promise<CurrentUserResponse> => {
  const { data } = await api.get<{ user: CurrentUserResponse }>("/users/me");
  if (!data.user?.id) {
    throw new Error("Invalid profile response.");
  }
  return data.user;
};

export const patchCurrentUser = async (body: {
  displayName?: string;
  avatarPreset?: number | null;
}): Promise<CurrentUserResponse> => {
  const { data } = await api.patch<{ user: CurrentUserResponse }>("/users/me", body);
  if (!data.user?.id) {
    throw new Error("Invalid profile response.");
  }
  return data.user;
};
