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

const formatMove = (move: MoveWithResult): string => {
  if (move.type !== "ASK") {
    return `[${move.playerId}] declared ${move.declaredSet ?? "a set"}`;
  }

  const target = move.targetPlayerId ?? "unknown";
  const card = move.card ? cardToString(move.card) : "a card";
  const result = move.success ? "Got it!" : "No luck";
  return `[${move.playerId}] asked [${target}] for ${card} -> ${result}`;
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
          <Text key={`${entry}-${index}`} style={styles.entry}>
            {entry}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 10,
    backgroundColor: "#f9fafb",
    padding: 12,
  },
  title: {
    fontWeight: "700",
    marginBottom: 8,
  },
  scroll: {
    maxHeight: 120,
  },
  content: {
    gap: 6,
  },
  entry: {
    color: "#374151",
  },
});
