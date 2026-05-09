import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Card } from "@shared/src";

import { CardView } from "../cards/CardView";

interface GameBoardProps {
  playedCards?: Card[];
}

export function GameBoard({ playedCards = [] }: GameBoardProps): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Game Board</Text>
      <View style={styles.cards}>
        {playedCards.map((card, index) => (
          <CardView
            key={`${card.suit}-${card.rank}-${index}`}
            card={card}
            faceUp
            selected={false}
            playable={false}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: "#065f46",
  },
  title: {
    color: "#ffffff",
    fontWeight: "700",
    marginBottom: 12,
  },
  cards: {
    flexDirection: "row",
    gap: 8,
  },
});
