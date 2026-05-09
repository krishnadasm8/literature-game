import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function AuthLayout(): JSX.Element {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "slide_from_bottom",
          presentation: "modal",
          contentStyle: { backgroundColor: "#0f172a" },
        }}
      />
    </>
  );
}
