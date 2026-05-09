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
      <Text style={[styles.label, styles.teamA]}>Team A: {teamAScore}</Text>
      <Text style={styles.round}>Round {round}</Text>
      <Text style={[styles.label, styles.teamB]}>Team B: {teamBScore}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#f59e0b",
    backgroundColor: "rgba(15,23,42,0.72)",
    shadowColor: "#000000",
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  label: {
    fontWeight: "700",
    fontSize: 13,
  },
  round: {
    fontWeight: "800",
    color: "#f59e0b",
    fontSize: 13,
  },
  teamA: {
    color: "#3b82f6",
  },
  teamB: {
    color: "#ef4444",
  },
});
