import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  ResponseType,
  makeRedirectUri,
} from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";

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
  console.log("Redirect URI:", redirectUri);

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
    <View style={styles.container}>
      <Text style={styles.title}>Sign In</Text>
      <Text style={styles.subtitle}>Sign in to continue to Literature.</Text>

      <Pressable
        style={[styles.button, (!request || loading) && styles.buttonDisabled]}
        disabled={!request || loading}
        onPress={() => {
          void onGooglePress();
        }}
      >
        {loading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.buttonText}>Continue with Google</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 20,
  },
  button: {
    minWidth: 220,
    borderRadius: 10,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  errorText: {
    marginTop: 12,
    color: "#dc2626",
    fontSize: 13,
  },
});
