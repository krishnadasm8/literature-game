import React, { useMemo, useRef } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import type { Move } from "@shared/src";

import { cardToString } from "../../utils/cardHelpers";

interface ActionLogProps {
  moves: Move[];
}

type MoveWithResult = Move & {
  success?: boolean;
};

const formatMove = (move: MoveWithResult): { text: string; success: boolean | null; timestamp: string } => {
  const timestamp = new Date(move.timestamp ?? Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (move.type !== "ASK") {
    return {
      text: `[${move.playerId}] declared ${move.declaredSet ?? "a set"}`,
      success: null,
      timestamp,
    };
  }

  const target = move.targetPlayerId ?? "unknown";
  const card = move.card ? cardToString(move.card) : "a card";
  const result = move.success ? "Got it!" : "No luck";
  return {
    text: `[${move.playerId}] asked [${target}] for ${card} -> ${result}`,
    success: Boolean(move.success),
    timestamp,
  };
};

export function ActionLog({ moves }: ActionLogProps): JSX.Element {
  const scrollRef = useRef<ScrollView>(null);
  const entries = useMemo(() => moves.map((move) => formatMove(move as MoveWithResult)), [moves]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Action Log</Text>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        onContentSizeChange={() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }}
      >
        {entries.map((entry, index) => (
          <View key={`${entry.text}-${index}`} style={styles.entryRow}>
            <Text
              style={[
                styles.entry,
                entry.success === true && styles.success,
                entry.success === false && styles.failure,
              ]}
            >
              {entry.text}
            </Text>
            <Text style={styles.time}>{entry.timestamp}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    backgroundColor: "rgba(15,23,42,0.55)",
    padding: 10,
  },
  title: {
    fontWeight: "700",
    marginBottom: 6,
    color: "#f8fafc",
    fontSize: 12,
  },
  scroll: {
    maxHeight: 80,
  },
  content: {
    gap: 5,
  },
  entryRow: {
    gap: 2,
  },
  entry: {
    color: "#d1d5db",
    fontSize: 11,
  },
  success: {
    color: "#22c55e",
  },
  failure: {
    color: "#ef4444",
  },
  time: {
    color: "#94a3b8",
    fontSize: 10,
  },
});
