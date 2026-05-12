import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as AuthSession from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";

import { useAuth } from "../../hooks/useAuth";

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export function GoogleSignInWebControls(): React.ReactElement {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: "literature",
        path: "auth",
      }),
    [],
  );

  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    {
      clientId: WEB_CLIENT_ID,
      webClientId: WEB_CLIENT_ID,
      scopes: ["openid", "profile", "email"],
    },
    { scheme: "literature", path: "auth" },
  );

  useEffect(() => {
    if (response?.type !== "success") {
      return;
    }

    const run = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const idToken =
          response.authentication?.idToken ?? (response.params?.id_token as string | undefined);
        if (!idToken) {
          setError("No Google ID token received.");
          return;
        }
        await signInWithGoogle(idToken, true, false);
        router.replace("/(tabs)");
      } catch (err) {
        const axiosData = (err as { response?: { data?: { error?: string } } })?.response?.data;
        setError(
          typeof axiosData?.error === "string"
            ? axiosData.error
            : err instanceof Error
              ? err.message
              : "Sign-in failed",
        );
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [response, router, signInWithGoogle]);

  const webClientMissing = !WEB_CLIENT_ID.trim();

  return (
    <View style={styles.wrap}>
      <Pressable
        style={[styles.button, (!request || loading || webClientMissing) && styles.buttonDisabled]}
        disabled={!request || loading || webClientMissing}
        onPress={() => {
          void promptAsync();
        }}
      >
        {loading ? (
          <ActivityIndicator color="#111827" />
        ) : (
          <Text style={styles.buttonText}>G  Continue with Google</Text>
        )}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      {webClientMissing ? (
        <Text style={styles.errorText}>Set EXPO_PUBLIC_GOOGLE_CLIENT_ID (Web OAuth client id).</Text>
      ) : null}

      <Text style={styles.hintText} selectable>
        Add this redirect under your Web client → Authorized redirect URIs:{"\n"}
        {redirectUri}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    gap: 10,
  },
  button: {
    width: "100%",
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
    marginTop: 4,
    color: "#ef4444",
    fontSize: 13,
    textAlign: "center",
  },
  hintText: {
    marginTop: 8,
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
  },
});
