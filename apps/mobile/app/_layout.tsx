import React, { useEffect, useMemo } from "react";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

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

  return <Stack screenOptions={{ headerShown: false }} />;
}
