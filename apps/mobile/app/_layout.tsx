import React, { useEffect, useMemo } from "react";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAuth } from "../hooks/useAuth";

void SplashScreen.preventAutoHideAsync();

export default function RootLayout(): JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated } = useAuth();
  const [fontsLoaded] = useFonts({});

  const isInAuthGroup = useMemo(() => segments[0] === "(auth)", [segments]);

  useEffect(() => {
    if (fontsLoaded) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    if (!fontsLoaded) {
      return;
    }

    if (isAuthenticated && isInAuthGroup) {
      router.replace("/(tabs)");
      return;
    }

    if (!isAuthenticated && !isInAuthGroup) {
      router.replace("/(auth)/signin");
    }
  }, [fontsLoaded, isAuthenticated, isInAuthGroup, router]);

  if (!fontsLoaded) {
    return <LoadingOverlay visible message="Loading assets..." />;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: styles.screenContent,
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal", animation: "slide_from_bottom" }} />
        <Stack.Screen
          name="game/[code]"
          options={({ navigation, route }) => {
            const roomCode = (route.params as { code?: string } | undefined)?.code?.toUpperCase() ?? "---";
            return {
              headerShown: true,
              headerStyle: styles.gameHeader,
              headerShadowVisible: false,
              headerTitleAlign: "center",
              headerTitle: () => (
                <View style={styles.gameHeaderTitleRow}>
                  <Text style={styles.gameHeaderRoomCode}>Room: {roomCode}</Text>
                </View>
              ),
              headerLeft: ({ canGoBack }) =>
                canGoBack ? (
                  <Pressable style={styles.backButton} onPress={navigation.goBack}>
                    <Text style={styles.backText}>← Back</Text>
                  </Pressable>
                ) : null,
              headerRight: () => (
                <Pressable
                  onPress={() => {
                    Alert.alert("Leave Game", "Are you sure you want to leave this game?", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Leave",
                        style: "destructive",
                        onPress: () => navigation.goBack(),
                      },
                    ]);
                  }}
                >
                  <Text style={styles.leaveGameText}>Leave Game</Text>
                </Pressable>
              ),
            };
          }}
        />
      </Stack>
    </>
  );
}

const styles = StyleSheet.create({
  screenContent: {
    backgroundColor: "#0f172a",
  },
  gameHeader: {
    backgroundColor: "#0f172a",
  },
  backButton: {
    paddingVertical: 6,
    paddingRight: 8,
  },
  backText: {
    color: "#f59e0b",
    fontWeight: "700",
    fontSize: 15,
  },
  gameHeaderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#f59e0b",
    paddingHorizontal: 10,
    paddingVertical: 3,
    backgroundColor: "rgba(245,158,11,0.1)",
  },
  gameHeaderRoomCode: {
    color: "#f59e0b",
    fontSize: 13,
    fontWeight: "800",
  },
  leaveGameText: {
    color: "#ef4444",
    fontWeight: "700",
    fontSize: 14,
  },
});
