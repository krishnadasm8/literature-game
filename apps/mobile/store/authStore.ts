import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface AuthUser {
  id: string;
  displayName: string;
  avatarUrl?: string;
  /** 1–8 cartoon preset, or null when using Google photo. */
  avatarPreset?: number | null;
  gamesPlayed: number;
  gamesWon: number;
  winRate: number;
  /** Omitted in older persisted sessions until next sign-in. */
  coins?: number;
}

interface AuthStoreState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setUser: (user: AuthUser, accessToken: string) => void;
  updateUserStats: (stats: Partial<Pick<AuthUser, "gamesPlayed" | "gamesWon" | "winRate" | "coins">>) => void;
  updateUserProfile: (patch: Partial<Pick<AuthUser, "displayName" | "avatarUrl" | "avatarPreset" | "winRate" | "coins">>) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      setUser: (user, accessToken) => {
        set({
          user,
          accessToken,
          isAuthenticated: true,
        });
      },
      updateUserStats: (stats) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...stats } : state.user,
        }));
      },
      updateUserProfile: (patch) => {
        set((state) => ({
          user: state.user ? { ...state.user, ...patch } : state.user,
        }));
      },
      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: "literature-auth-store",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Auth store rehydration error:", error);
        }
      },
    },
  ),
);
