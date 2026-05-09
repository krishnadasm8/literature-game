import React from "react";
import { StyleSheet, View } from "react-native";

interface CardBackProps {
  width?: number;
  height?: number;
}

export function CardBack({ width = 72, height = 104 }: CardBackProps): JSX.Element {
  return (
    <View style={[styles.card, { width, height }]}>
      <View style={styles.pattern} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#1f2937",
    backgroundColor: "#1d4ed8",
    padding: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  pattern: {
    width: "100%",
    height: "100%",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#2563eb",
  },
});
