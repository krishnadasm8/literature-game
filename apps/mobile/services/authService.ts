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
  userId?: string;
  displayName?: string;
  avatarUrl?: string | null;
  user?: {
    id?: string;
    displayName?: string;
    avatarUrl?: string | null;
    gamesPlayed?: number | null;
    gamesWon?: number | null;
    winRate?: number | null;
  };
}

export const googleSignIn = async (
  token: string,
  isIdToken: boolean = true,
  isAuthCode: boolean = false,
): Promise<GoogleSignInResult> => {
  let payload: Record<string, string>;

  if (isAuthCode) {
    payload = {
      code: token,
      redirectUri: "com.literaturecardgame:/",
    };
  } else if (isIdToken) {
    payload = { idToken: token };
  } else {
    payload = { accessToken: token };
  }

  console.log(
    "googleSignIn payload type:",
    isAuthCode ? "code" : isIdToken ? "idToken" : "accessToken",
  );

  const response = await api.post<BackendGoogleAuthResponse>("/auth/google", payload);
  const data = response.data;

  console.log("googleSignIn response:", data);

  const accessToken = data.accessToken;
  const refreshToken = data.refreshToken;
  if (typeof accessToken !== "string" || typeof refreshToken !== "string") {
    throw new Error("Invalid sign-in response from server.");
  }

  const userId = data.user?.id ?? data.userId;
  if (typeof userId !== "string" || !userId) {
    throw new Error("Invalid sign-in response from server.");
  }

  return {
    userId,
    displayName: data.user?.displayName ?? data.displayName ?? "Player",
    avatarUrl: data.user?.avatarUrl ?? data.avatarUrl ?? "",
    gamesPlayed: data.user?.gamesPlayed ?? 0,
    gamesWon: data.user?.gamesWon ?? 0,
    winRate: data.user?.winRate ?? 0,
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
