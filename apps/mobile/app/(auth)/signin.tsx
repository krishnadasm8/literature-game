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

/** Parse fragment + query from custom-scheme redirects without relying on `new URL`. */
function oauthRedirectParams(resultUrl: string): {
  hashParams: URLSearchParams;
  searchParams: URLSearchParams;
} {
  let rest = resultUrl;
  let fragment = "";
  const hashIdx = rest.indexOf("#");
  if (hashIdx !== -1) {
    fragment = rest.slice(hashIdx + 1);
    rest = rest.slice(0, hashIdx);
  }
  let query = "";
  const qIdx = rest.indexOf("?");
  if (qIdx !== -1) {
    query = rest.slice(qIdx + 1);
  }
  return {
    hashParams: new URLSearchParams(fragment),
    searchParams: new URLSearchParams(query),
  };
}

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
      const state = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
      );

      const nonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        Math.random().toString(),
      );

      const isAndroid = Platform.OS === "android";
      const clientId = isAndroid
        ? process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID
        : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

      const redirectUri = isAndroid ? "com.literaturecardgame:/" : "http://localhost:8081/auth";

      const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      authUrl.searchParams.set("client_id", clientId ?? "");
      authUrl.searchParams.set("redirect_uri", redirectUri);
      authUrl.searchParams.set("scope", "openid profile email");
      authUrl.searchParams.set("state", state);
      authUrl.searchParams.set("nonce", nonce);

      // CRITICAL FIX: Android uses 'code' not 'token id_token'
      if (isAndroid) {
        authUrl.searchParams.set("response_type", "code");
        authUrl.searchParams.set("access_type", "offline");
      } else {
        authUrl.searchParams.set("response_type", "token id_token");
      }

      console.log("Final Auth URL:", authUrl.toString());
      console.log("response_type:", authUrl.searchParams.get("response_type"));

      const result = await WebBrowser.openAuthSessionAsync(authUrl.toString(), redirectUri);

      console.log("Result type:", result.type);
      if (result.type !== "success") {
        setError("Sign-in was cancelled.");
        return;
      }

      console.log("Result URL:", result.url);

      const { hashParams, searchParams } = oauthRedirectParams(result.url);

      const code = searchParams.get("code") ?? hashParams.get("code");
      const idToken = hashParams.get("id_token") ?? searchParams.get("id_token");
      const accessToken = hashParams.get("access_token") ?? searchParams.get("access_token");

      console.log("code:", !!code);
      console.log("idToken:", !!idToken);
      console.log("accessToken:", !!accessToken);

      if (isAndroid && code) {
        await signInWithGoogle(code, false, true);
      } else {
        const token = idToken ?? accessToken;
        if (!token) {
          setError("No token received from Google");
          return;
        }
        await signInWithGoogle(token, !!idToken, false);
      }

      router.replace("/(tabs)");
    } catch (err) {
      console.error("Sign in error:", err);
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const debugClientId =
    Platform.OS === "android"
      ? process.env.EXPO_PUBLIC_ANDROID_CLIENT_ID
      : process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;
  const debugRedirect =
    Platform.OS === "android" ? "com.literaturecardgame:/" : "http://localhost:8081/auth";

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

        {__DEV__ ? (
          <Text style={styles.debugText}>
            {`ClientID: ${debugClientId?.substring(0, 20)}...`}
            {"\n"}
            {`Redirect: ${debugRedirect}`}
            {"\n"}
            {`Platform: ${Platform.OS}`}
          </Text>
        ) : null}
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
