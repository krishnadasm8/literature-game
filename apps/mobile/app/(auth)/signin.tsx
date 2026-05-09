import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ResponseType,
  makeRedirectUri,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { StatusBar } from "expo-status-bar";

import { useAuth } from "../../hooks/useAuth";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen(): JSX.Element {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const googleClientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID;

  const redirectUri = useMemo(
    () =>
      makeRedirectUri({
        scheme: "literature",
        path: "auth",
        preferLocalhost: true,
      }),
    [],
  );
  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: googleClientId,
    androidClientId: googleClientId,
    iosClientId: googleClientId,
    webClientId: googleClientId,
    scopes: ["openid", "profile", "email"],
    responseType: ResponseType.IdToken,
    redirectUri,
  });

  useEffect(() => {
    const run = async (): Promise<void> => {
      if (response?.type !== "success") {
        return;
      }

      const idToken =
        response.authentication?.idToken ?? response.params?.id_token;

      if (!idToken) {
        setError("Google did not return an ID token.");
        return;
      }

      setLoading(true);
      setError(null);
      try {
        await signInWithGoogle(idToken);
        router.replace("/(tabs)");
      } catch (authError) {
        setError(authError instanceof Error ? authError.message : "Sign-in failed.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [response, router, signInWithGoogle]);

  const onGooglePress = async (): Promise<void> => {
    if (!request || loading) {
      return;
    }
    setError(null);
    await promptAsync();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.suits}>♠ ♥ ♦ ♣</Text>
        <Text style={styles.title}>LITERATURE</Text>
        <Text style={styles.subtitle}>Canadian Card Game</Text>

        <Pressable
          style={[styles.button, (!request || loading) && styles.buttonDisabled]}
          disabled={!request || loading}
          onPress={() => {
            void onGooglePress();
          }}
        >
          {loading ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={styles.buttonText}>G Continue with Google</Text>
          )}
        </Pressable>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
      <Text style={styles.legalText}>By continuing you agree to our Terms of Service</Text>
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
  legalText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
  },
});
