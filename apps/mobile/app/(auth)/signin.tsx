import React from "react";
import { Platform, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";

import { GoogleSignInNativeControls } from "../../components/auth/GoogleSignInNative";
import { GoogleSignInWebControls } from "../../components/auth/GoogleSignInWeb";

/**
 * Sign-in shell. Web uses OAuth in the browser (`GoogleSignInWeb.web.tsx`).
 * Android / iOS use native Google Sign-In (`GoogleSignInNative.native.tsx`) — no `accounts.google.com` redirect flow.
 */
export default function SignInScreen(): JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.center}>
        <Text style={styles.suits}>♠ ♥ ♦ ♣</Text>
        <Text style={styles.title}>LITERATURE</Text>
        <Text style={styles.subtitle}>Canadian Card Game</Text>

        {Platform.OS === "web" ? <GoogleSignInWebControls /> : <GoogleSignInNativeControls />}
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
  legalText: {
    color: "#94a3b8",
    fontSize: 11,
    textAlign: "center",
    marginBottom: 6,
  },
});
