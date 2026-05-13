import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";

import type { Card } from "@shared/src";

interface CardDisplayProps {
  card: Card;
  size?: "small" | "medium" | "large";
}

const SIZE_MAP = {
  small: { width: 52, height: 76, cornerRank: 12, cornerSuit: 11, centerSuit: 24 },
  medium: { width: 72, height: 104, cornerRank: 16, cornerSuit: 14, centerSuit: 32 },
  large: { width: 96, height: 140, cornerRank: 20, cornerSuit: 18, centerSuit: 46 },
} as const;

const SUIT_SYMBOL = {
  SPADES: "\u2660",
  CLUBS: "\u2663",
  HEARTS: "\u2665",
  DIAMONDS: "\u2666",
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

const androidTextProps = Platform.OS === "android" ? ({ textBreakStrategy: "simple" as const } as const) : {};

const baseTextProps = {
  includeFontPadding: false,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  ...androidTextProps,
} as const;

export function CardDisplay({ card, size = "medium" }: CardDisplayProps): JSX.Element {
  const dims = SIZE_MAP[size];
  const suitSymbol = SUIT_SYMBOL[card.suit];
  const suitColor = SUIT_COLOR[card.suit];
  const rankText = RANK_TEXT[card.rank];

  const cornerRankSize = rankText.length >= 2 ? Math.round(dims.cornerRank * 0.88) : dims.cornerRank;

  return (
    <View style={[styles.card, { width: dims.width, height: dims.height }]}>
      <View style={[styles.cornerTop, { padding: Math.max(4, dims.width * 0.08) }]} collapsable={false}>
        <Text
          {...baseTextProps}
          numberOfLines={1}
          style={[
            styles.cornerRank,
            {
              color: suitColor,
              fontSize: cornerRankSize,
              lineHeight: Math.round(cornerRankSize * 1.12),
            },
          ]}
        >
          {rankText}
        </Text>
        <Text
          {...baseTextProps}
          numberOfLines={1}
          style={[
            styles.cornerSuit,
            {
              color: suitColor,
              fontSize: dims.cornerSuit,
              lineHeight: Math.round(dims.cornerSuit * 1.05),
            },
          ]}
        >
          {suitSymbol}
        </Text>
      </View>

      <View style={styles.centerWrap} pointerEvents="none" collapsable={false}>
        <Text
          {...baseTextProps}
          numberOfLines={1}
          style={[
            styles.centerSuit,
            {
              color: suitColor,
              fontSize: dims.centerSuit,
              lineHeight: Math.round(dims.centerSuit * 1.05),
            },
          ]}
        >
          {suitSymbol}
        </Text>
      </View>

      <View style={[styles.cornerBottom, { padding: Math.max(4, dims.width * 0.08) }]} collapsable={false}>
        <Text
          {...baseTextProps}
          numberOfLines={1}
          style={[
            styles.cornerRank,
            styles.alignEnd,
            {
              color: suitColor,
              fontSize: cornerRankSize,
              lineHeight: Math.round(cornerRankSize * 1.12),
            },
          ]}
        >
          {rankText}
        </Text>
        <Text
          {...baseTextProps}
          numberOfLines={1}
          style={[
            styles.cornerSuit,
            styles.alignEnd,
            {
              color: suitColor,
              fontSize: dims.cornerSuit,
              lineHeight: Math.round(dims.cornerSuit * 1.05),
            },
          ]}
        >
          {suitSymbol}
        </Text>
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
    position: "relative",
  },
  cornerTop: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2,
    alignItems: "flex-start",
  },
  cornerBottom: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: "flex-end",
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  alignEnd: {
    textAlign: "right",
    alignSelf: "stretch",
  },
  cornerRank: {
    fontWeight: "800",
  },
  cornerSuit: {
    marginTop: 1,
    fontWeight: "600",
  },
  centerSuit: {
    fontWeight: "700",
    textAlign: "center",
  },
});
