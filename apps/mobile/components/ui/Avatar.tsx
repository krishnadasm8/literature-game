import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

interface AvatarProps {
  displayName: string;
  avatarUrl?: string;
  size?: number;
}

export function Avatar({ displayName, avatarUrl, size = 40 }: AvatarProps): JSX.Element {
  const initials = useMemo(() => {
    const parts = displayName.trim().split(/\s+/);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [displayName]);

  void avatarUrl;

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={styles.initials}>{initials || "?"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#1f2937",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
