import React from "react";
import { Tabs } from "expo-router";

export default function TabsLayout(): JSX.Element {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="lobby" options={{ title: "Lobby" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
      <Tabs.Screen name="store" options={{ title: "Store" }} />
    </Tabs>
  );
}
