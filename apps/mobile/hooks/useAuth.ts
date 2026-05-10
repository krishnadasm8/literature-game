import { useCallback } from "react";

import { googleSignIn, logout } from "../services/authService";
import { useAuthStore, type AuthUser } from "../store/authStore";
import { deleteToken, saveToken } from "../utils/storage";

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

interface UseAuthResult {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuth = (): UseAuthResult => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const setUser = useAuthStore((state) => state.setUser);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const signInWithGoogle = useCallback(
    async (idToken: string) => {
      const result = await googleSignIn(idToken);
      setUser(
        {
          id: result.userId,
          displayName: result.displayName,
          avatarUrl: result.avatarUrl,
          gamesPlayed: result.gamesPlayed,
          gamesWon: result.gamesWon,
          winRate: result.winRate,
        },
        result.tokens.accessToken,
      );
      await saveToken(ACCESS_TOKEN_KEY, result.tokens.accessToken);
      await saveToken(REFRESH_TOKEN_KEY, result.tokens.refreshToken);
    },
    [setUser],
  );

  const signOut = useCallback(async () => {
    try {
      await logout();
    } finally {
      clearAuth();
      await deleteToken(ACCESS_TOKEN_KEY);
      await deleteToken(REFRESH_TOKEN_KEY);
    }
  }, [clearAuth]);

  return {
    user,
    accessToken,
    isAuthenticated,
    signInWithGoogle,
    signOut,
  };
};
