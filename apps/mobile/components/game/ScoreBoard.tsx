import React from "react";
import { StyleSheet, Text, View } from "react-native";

interface ScoreBoardProps {
  teamAScore: number;
  teamBScore: number;
  round: number;
}

export function ScoreBoard({ teamAScore, teamBScore, round }: ScoreBoardProps): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Team A: {teamAScore}</Text>
      <Text style={styles.round}>Round {round}</Text>
      <Text style={styles.label}>Team B: {teamBScore}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f3f4f6",
  },
  label: {
    fontWeight: "700",
    color: "#111827",
  },
  round: {
    fontWeight: "600",
    color: "#374151",
  },
});
