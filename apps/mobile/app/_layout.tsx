import React, { useEffect, useMemo } from "react";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { LoadingOverlay } from "../components/ui/LoadingOverlay";
import { useAuth } from "../hooks/useAuth";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("App crashed:", error.message);
    console.error("Component stack:", info.componentStack);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: "#0f172a",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Text
            style={{
              color: "#f59e0b",
              fontSize: 24,
              fontWeight: "800",
              marginBottom: 16,
            }}
          >
            ♠ Literature
          </Text>
          <Text
            style={{
              color: "#ef4444",
              fontSize: 14,
              textAlign: "center",
              marginBottom: 8,
            }}
          >
            Something went wrong
          </Text>
          <Text
            style={{
              color: "#64748b",
              fontSize: 11,
              textAlign: "center",
            }}
          >
            {this.state.error?.message ?? "Unknown error"}
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

void SplashScreen.preventAutoHideAsync();

// Global error handler for uncaught JS errors
if (typeof ErrorUtils !== "undefined") {
  const originalHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error("Global error:", error?.message, "fatal:", isFatal);
    originalHandler(error, isFatal);
  });
}

export default function RootLayout(): JSX.Element {
  const router = useRouter();
  const segments = useSegments();
  const { isAuthenticated } = useAuth();
  const [fontsLoaded, fontError] = useFonts({});

  const isInAuthGroup = useMemo(
    () => segments[0] === "(auth)",
    [segments]
  );

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (!fontsLoaded && !fontError) {
      return;
    }
    if (isAuthenticated && isInAuthGroup) {
      router.replace("/(tabs)");
      return;
    }
    if (!isAuthenticated && !isInAuthGroup) {
      router.replace("/(auth)/signin");
    }
  }, [fontsLoaded, fontError, isAuthenticated, isInAuthGroup, router]);

  if (!fontsLoaded && !fontError) {
    return <LoadingOverlay visible message="Loading..." />;
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: styles.screenContent,
              animation: "slide_from_right",
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="(auth)"
              options={{
                headerShown: false,
                presentation: "modal",
                animation: "slide_from_bottom",
              }}
            />
            <Stack.Screen
              name="game/[code]"
              options={({ navigation, route }) => {
                const roomCode =
                  (route.params as { code?: string } | undefined)
                    ?.code?.toUpperCase() ?? "---";
                return {
                  headerShown: true,
                  headerStyle: styles.gameHeader,
                  headerShadowVisible: false,
                  headerTitleAlign: "center",
                  headerTitle: () => (
                    <View style={styles.gameHeaderTitleRow}>
                      <Text style={styles.gameHeaderRoomCode}>
                        Room: {roomCode}
                      </Text>
                    </View>
                  ),
                  headerLeft: ({ canGoBack }) =>
                    canGoBack ? (
                      <Pressable
                        style={styles.backButton}
                        onPress={navigation.goBack}
                      >
                        <Text style={styles.backText}>← Back</Text>
                      </Pressable>
                    ) : null,
                  headerRight: () => (
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          "Leave Game?",
                          "Are you sure? Your team may forfeit.",
                          [
                            { text: "Stay", style: "cancel" },
                            {
                              text: "Leave",
                              style: "destructive",
                              onPress: () => navigation.goBack(),
                            },
                          ]
                        );
                      }}
                    >
                      <Text style={styles.leaveGameText}>Leave Game</Text>
                    </Pressable>
                  ),
                };
              }}
            />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
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
    paddingLeft: 4,
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
    paddingRight: 4,
  },
});
