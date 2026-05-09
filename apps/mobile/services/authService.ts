import { api } from "./api";

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface GoogleSignInResult {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  tokens: AuthTokens;
}

interface BackendGoogleAuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
  };
}

export const googleSignIn = async (idToken: string): Promise<GoogleSignInResult> => {
  const response = await api.post<BackendGoogleAuthResponse>("/auth/google", {
    idToken,
  });

  return {
    userId: response.data.user.id,
    displayName: response.data.user.displayName,
    avatarUrl: response.data.user.avatarUrl ?? undefined,
    tokens: {
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken,
    },
  };
};

export const refreshToken = async (_refreshToken: string): Promise<AuthTokens> => {
  throw new Error("refreshToken is not implemented");
};

export const logout = async (): Promise<void> => {
  throw new Error("logout is not implemented");
};
