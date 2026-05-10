import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Card } from "@shared/src";

interface CardDisplayProps {
  card: Card;
  size?: "small" | "medium" | "large";
}

const SIZE_MAP = {
  small: { width: 52, height: 76, cornerRank: 12, cornerSuit: 10, centerSuit: 24 },
  medium: { width: 72, height: 104, cornerRank: 16, cornerSuit: 12, centerSuit: 32 },
  large: { width: 96, height: 140, cornerRank: 22, cornerSuit: 16, centerSuit: 46 },
} as const;

const SUIT_SYMBOL = {
  SPADES: "♠",
  CLUBS: "♣",
  HEARTS: "♥",
  DIAMONDS: "♦",
} as const;

const SUIT_COLOR = {
  SPADES: "#111827",
  CLUBS: "#111827",
  HEARTS: "#dc2626",
  DIAMONDS: "#dc2626",
} as const;

const RANK_TEXT = {
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  NINE: "9",
  TEN: "10",
  JACK: "J",
  QUEEN: "Q",
  KING: "K",
  ACE: "A",
} as const;

export function CardDisplay({ card, size = "medium" }: CardDisplayProps): JSX.Element {
  const dims = SIZE_MAP[size];
  const suitSymbol = SUIT_SYMBOL[card.suit];
  const suitColor = SUIT_COLOR[card.suit];
  const rankText = RANK_TEXT[card.rank];

  return (
    <View style={[styles.card, { width: dims.width, height: dims.height }]}>
      <View style={styles.cornerTop}>
        <Text style={[styles.cornerRank, { color: suitColor, fontSize: dims.cornerRank }]}>{rankText}</Text>
        <Text style={[styles.cornerSuit, { color: suitColor, fontSize: dims.cornerSuit }]}>{suitSymbol}</Text>
      </View>

      <View style={styles.centerWrap}>
        <Text style={[styles.centerSuit, { color: suitColor, fontSize: dims.centerSuit }]}>{suitSymbol}</Text>
      </View>

      <View style={styles.cornerBottom}>
        <Text style={[styles.cornerRank, { color: suitColor, fontSize: dims.cornerRank }]}>{rankText}</Text>
        <Text style={[styles.cornerSuit, { color: suitColor, fontSize: dims.cornerSuit }]}>{suitSymbol}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    overflow: "hidden",
  },
  cornerTop: {
    position: "absolute",
    top: 6,
    left: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  cornerBottom: {
    position: "absolute",
    right: 6,
    bottom: 6,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "180deg" }],
  },
  cornerRank: {
    fontWeight: "800",
    lineHeight: 20,
  },
  cornerSuit: {
    marginTop: -2,
    fontWeight: "800",
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  centerSuit: {
    fontWeight: "800",
    lineHeight: 48,
  },
});
