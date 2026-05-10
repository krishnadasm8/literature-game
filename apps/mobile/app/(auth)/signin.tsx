import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Crypto from "expo-crypto";
import { StatusBar } from "expo-status-bar";
import { useAuth } from "../../hooks/useAuth";

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = Platform.select({
  android: process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID,
  ios: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
  default: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID,
});

const REDIRECT_URI = Platform.select({
  android: "com.literaturecardgame:/",
  ios: "literature://auth",
  default: `${process.env.EXPO_PUBLIC_API_URL?.replace("/api/v1", "")}/auth/callback`,
});

export default function SignInScreen(): JSX.Element {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      // Generate random state for security
      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
      );

      // Build Google OAuth URL
      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID ?? "");
      authUrl.searchParams.set("redirect_uri", REDIRECT_URI ?? "");
      authUrl.searchParams.set("response_type", "token id_token");
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", state);

      console.log("Auth URL:", authUrl.toString());
      console.log("Client ID:", GOOGLE_CLIENT_ID);
      console.log("Redirect URI:", REDIRECT_URI);

      // Open browser
      const result = await WebBrowser.openAuthSessionAsync(
        authUrl.toString(),
        REDIRECT_URI ?? "",
      );

      console.log("Auth result type:", result.type);

      if (result.type !== "success") {
        setError("Sign-in was cancelled or failed.");
        return;
      }

      // Parse the response URL
      const url = new URL(result.url);
      const params = new URLSearchParams(
        url.hash.substring(1) || url.search.substring(1),
      );

      const idToken = params.get("id_token");
      const accessToken = params.get("access_token");

      console.log("Got idToken:", !!idToken);
      console.log("Got accessToken:", !!accessToken);

      const token = idToken ?? accessToken;
      if (!token) {
        setError("No token in response");
        return;
      }

      await signInWithGoogle(token, !!idToken);
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.suits}>♠ ♥ ♦ ♣</Text>
        <Text style={styles.title}>LITERATURE</Text>
        <Text style={styles.subtitle}>Canadian Card Game</Text>

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          disabled={loading}
          onPress={() => {
            void handleGoogleSignIn();
          }}
        >
          {loading ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.buttonText}>G Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {__DEV__ && (
          <Text style={styles.debugText}>
            {`ClientID: ${GOOGLE_CLIENT_ID?.substring(0, 20)}...`}
            {"\n"}
            {`Redirect: ${REDIRECT_URI}`}
            {"\n"}
            {`Platform: ${Platform.OS}`}
          </Text>
        )}
      </View>
      <Text style={styles.legalText}>
        By continuing you agree to our Terms of Service
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
    padding: 24,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  suits: {
    fontSize: 22,
    fontWeight: "700",
    color: "#94a3b8",
  },
  title: {
    fontSize: 38,
    fontWeight: "900",
    color: "#f59e0b",
  },
  subtitle: {
    fontSize: 14,
    color: "#94a3b8",
    marginBottom: 20,
  },
  button: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 14,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#111827",
    fontWeight: "800",
    fontSize: 15,
  },
  errorText: {
    marginTop: 12,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
  debugText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 10,
    textAlign: "center",
  },
  legalText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
  },
});
