import * as Application from "expo-application";
import { Platform } from "react-native";

import { api } from "./api";

const GOOGLE_CLIENT_SUFFIX = ".apps.googleusercontent.com";

/** Redirect URI for server-side auth-code exchange (only if something sends a `code` + PKCE). */
function googleCodeExchangeRedirectUri(): string {
  const appId = Application.applicationId?.trim() ?? "com.literaturecardgame";
  if (Platform.OS === "ios") {
    const iosClientId = (process.env.EXPO_PUBLIC_IOS_CLIENT_ID ?? "").trim();
    if (iosClientId.endsWith(GOOGLE_CLIENT_SUFFIX)) {
      const idPart = iosClientId.slice(0, -GOOGLE_CLIENT_SUFFIX.length);
      return `com.googleusercontent.apps.${idPart}:/oauth2redirect`;
    }
  }
  if (Platform.OS === "android") {
    const androidClientId = (process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID ?? "").trim();
    if (androidClientId.endsWith(GOOGLE_CLIENT_SUFFIX)) {
      const idPart = androidClientId.slice(0, -GOOGLE_CLIENT_SUFFIX.length);
      return `com.googleusercontent.apps.${idPart}:/oauth2redirect`;
    }
  }
  return `${appId}:/oauth2redirect`;
}

function googleCodeExchangeClientId(): string {
  const android = (process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID ?? "").trim();
  const ios = (process.env.EXPO_PUBLIC_IOS_CLIENT_ID ?? "").trim();
  if (Platform.OS === "ios" && ios) {
    return ios;
  }
  return android;
}

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

function consumeGooglePkceVerifier(): string | undefined {
  const g = globalThis as { __codeVerifier?: string };
  const v = g.__codeVerifier;
  delete g.__codeVerifier;
  return v;
}

export const googleSignIn = async (
  token: string,
  isIdToken: boolean = true,
  isAuthCode: boolean = false,
): Promise<GoogleSignInResult> => {
  let payload: Record<string, string>;

  if (isAuthCode) {
    const codeVerifier = consumeGooglePkceVerifier();
    const clientId = googleCodeExchangeClientId();
    const redirectUri = googleCodeExchangeRedirectUri();

    payload = {
      code: token,
      redirectUri,
      clientId,
      codeVerifier: codeVerifier ?? "",
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
  try {
    await api.post("/auth/logout", {});
  } catch {
    // Best-effort; client still clears local session in useAuth.
  }
};
