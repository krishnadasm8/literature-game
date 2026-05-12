import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { GoogleSignin, statusCodes } from "@react-native-google-signin/google-signin";
import { useRouter } from "expo-router";

import { useAuth } from "../../hooks/useAuth";

const WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";
const IOS_CLIENT_ID = process.env.EXPO_PUBLIC_IOS_CLIENT_ID ?? "";

/**
 * Android / iOS Google Sign-In via Play Services / GoogleSignIn SDK.
 * Sends an ID token (audience = Web client id) to your backend — no browser OAuth redirect.
 */
export function GoogleSignInNativeControls(): React.ReactElement {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!WEB_CLIENT_ID.trim()) {
      setError("Set EXPO_PUBLIC_GOOGLE_CLIENT_ID (Web OAuth client id — used for ID tokens).");
      setReady(false);
      return;
    }

    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID.trim(),
      ...(Platform.OS === "ios" && IOS_CLIENT_ID.trim()
        ? { iosClientId: IOS_CLIENT_ID.trim() }
        : {}),
      scopes: ["email", "profile"],
      offlineAccess: false,
    });
    setReady(true);
  }, []);

  const onPress = useCallback(async () => {
    if (!ready || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const signInResult = await GoogleSignin.signIn();
      if (signInResult.type !== "success") {
        return;
      }
      const { idToken } = await GoogleSignin.getTokens();
      if (!idToken) {
        setError("Google did not return an ID token. Check Web client id and SHA-1 / bundle id in Google Cloud.");
        return;
      }
      await signInWithGoogle(idToken, true, false);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      const code = typeof e === "object" && e !== null && "code" in e ? (e as { code: string }).code : "";
      if (code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      const message =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e !== null && "message" in e
            ? String((e as { message: unknown }).message)
            : "Google sign-in failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [ready, loading, router, signInWithGoogle]);

  const disabled = !ready || loading || !WEB_CLIENT_ID.trim();

  return (
    <View style={styles.wrap}>
      <Pressable style={[styles.button, disabled && styles.buttonDisabled]} disabled={disabled} onPress={() => void onPress()}>
        {loading ? <ActivityIndicator color="#111827" /> : <Text style={styles.buttonText}>G  Continue with Google</Text>}
      </Pressable>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Text style={styles.hintText}>
        Native Google Sign-In (no browser redirect). Ensure your Web client id is set and, on Android, your debug/release
        SHA-1 is registered for package {Platform.OS === "android" ? "com.literaturecardgame" : "your iOS bundle"} in Google
        Cloud.
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
