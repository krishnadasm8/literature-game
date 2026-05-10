import { api } from "./api";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleSignInResult {
  userId: string;
  displayName: string;
  avatarUrl: string;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  tokens: AuthTokens;
}

interface BackendGoogleAuthResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id?: string;
    displayName?: string;
    avatarUrl?: string | null;
    gamesPlayed?: number | null;
    gamesWon?: number | null;
  };
}

function computeWinRate(gamesPlayed: number, gamesWon: number): number {
  if (gamesPlayed <= 0) {
    return 0;
  }
  return Math.round((gamesWon / gamesPlayed) * 100);
}

export const googleSignIn = async (idToken: string): Promise<GoogleSignInResult> => {
  const response = await api.post<BackendGoogleAuthResponse>("/auth/google", {
    idToken,
  });

  const data = response.data;
  const user = data?.user;

  const accessToken = data?.accessToken;
  const refreshToken = data?.refreshToken;
  const userId = user?.id;

  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    typeof userId !== "string"
  ) {
    throw new Error("Invalid sign-in response from server.");
  }

  const gamesPlayed = Number(user?.gamesPlayed) || 0;
  const gamesWon = Number(user?.gamesWon) || 0;
  const displayName =
    typeof user?.displayName === "string" && user.displayName.trim().length > 0
      ? user.displayName.trim()
      : "Player";

  return {
    userId,
    displayName,
    avatarUrl: typeof user?.avatarUrl === "string" ? user.avatarUrl : "",
    gamesPlayed,
    gamesWon,
    winRate: computeWinRate(gamesPlayed, gamesWon),
    tokens: {
      accessToken,
      refreshToken,
    },
  };
};

export const refreshToken = async (_refreshToken: string): Promise<AuthTokens> => {
  throw new Error("refreshToken is not implemented");
};

export const logout = async (): Promise<void> => {
  throw new Error("logout is not implemented");
};
