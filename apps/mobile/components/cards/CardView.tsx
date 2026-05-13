import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Rank, Suit, type Card } from "@shared/src";

import { CardBack } from "./CardBack";

interface CardViewProps {
  card: Card;
  faceUp: boolean;
  selected: boolean;
  playable: boolean;
  onPress?: () => void;
  width?: number;
  height?: number;
  selectedLift?: number;
}

/** Unicode suit glyphs (avoid odd font fallbacks on some Android builds). */
const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  [Suit.SPADES]: "\u2660",
  [Suit.HEARTS]: "\u2665",
  [Suit.DIAMONDS]: "\u2666",
  [Suit.CLUBS]: "\u2663",
};

const RANK_LABELS: Record<Card["rank"], string> = {
  [Rank.TWO]: "2",
  [Rank.THREE]: "3",
  [Rank.FOUR]: "4",
  [Rank.FIVE]: "5",
  [Rank.SIX]: "6",
  [Rank.SEVEN]: "7",
  [Rank.NINE]: "9",
  [Rank.TEN]: "10",
  [Rank.JACK]: "J",
  [Rank.QUEEN]: "Q",
  [Rank.KING]: "K",
  [Rank.ACE]: "A",
};

const androidTextProps = Platform.OS === "android" ? ({ textBreakStrategy: "simple" as const } as const) : {};

const baseTextProps = {
  includeFontPadding: false,
  allowFontScaling: false,
  maxFontSizeMultiplier: 1,
  ...androidTextProps,
} as const;

export function CardView({
  card,
  faceUp,
  selected,
  playable,
  onPress,
  width = 52,
  height = 76,
  selectedLift = 12,
}: CardViewProps): JSX.Element {
  const isRedSuit = card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS;
  const scale = useSharedValue(1);
  const lift = useSharedValue(selected ? -selectedLift : 0);

  useEffect(() => {
    lift.value = withSpring(selected ? -selectedLift : 0, {
      damping: 14,
      stiffness: 180,
    });
  }, [lift, selected, selectedLift]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = RANK_LABELS[card.rank];
  const cornerColor = isRedSuit ? "#dc2626" : "#111827";

  const edge = Math.max(3, Math.round(width * 0.08));
  const cornerRankSize =
    rankStr.length >= 2 ? Math.max(7, Math.round(width * 0.14)) : Math.max(8, Math.round(width * 0.17));
  const cornerSuitSize = Math.max(9, Math.round(width * 0.19));
  const centerSuitSize = Math.max(15, Math.round(width * 0.36));

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withTiming(0.95, { duration: 120 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 140 });
      }}
      style={styles.pressable}
    >
      <Animated.View style={animatedStyle}>
        {faceUp ? (
          <View
            style={[
              styles.cardFace,
              { width, height },
              playable && styles.playableCard,
              !playable && styles.nonPlayableCard,
              selected && styles.selectedCard,
            ]}
          >
            <View style={[styles.cornerTL, { padding: edge }]} collapsable={false}>
              <Text
                {...baseTextProps}
                numberOfLines={1}
                style={[
                  styles.rankText,
                  {
                    fontSize: cornerRankSize,
                    lineHeight: Math.round(cornerRankSize * 1.12),
                    color: cornerColor,
                  },
                ]}
              >
                {rankStr}
              </Text>
              <Text
                {...baseTextProps}
                numberOfLines={1}
                style={[
                  styles.suitTextSmall,
                  {
                    fontSize: cornerSuitSize,
                    lineHeight: Math.round(cornerSuitSize * 1.05),
                    color: cornerColor,
                  },
                ]}
              >
                {symbol}
              </Text>
            </View>

            <View style={styles.centerWrap} pointerEvents="none" collapsable={false}>
              <Text
                {...baseTextProps}
                numberOfLines={1}
                style={[
                  styles.suitTextCenter,
                  {
                    fontSize: centerSuitSize,
                    lineHeight: Math.round(centerSuitSize * 1.05),
                    color: cornerColor,
                  },
                ]}
              >
                {symbol}
              </Text>
            </View>

            <View style={[styles.cornerBR, { padding: edge }]} collapsable={false}>
              <Text
                {...baseTextProps}
                numberOfLines={1}
                style={[
                  styles.rankText,
                  styles.cornerAlignEnd,
                  {
                    fontSize: cornerRankSize,
                    lineHeight: Math.round(cornerRankSize * 1.12),
                    color: cornerColor,
                  },
                ]}
              >
                {rankStr}
              </Text>
              <Text
                {...baseTextProps}
                numberOfLines={1}
                style={[
                  styles.suitTextSmall,
                  styles.cornerAlignEnd,
                  {
                    fontSize: cornerSuitSize,
                    lineHeight: Math.round(cornerSuitSize * 1.05),
                    color: cornerColor,
                  },
                ]}
              >
                {symbol}
              </Text>
            </View>
          </View>
        ) : (
          <View style={[styles.cardFace, styles.cardBack, selected && styles.selectedCard, { width, height }]}>
            <CardBack width={width} height={height} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 8,
    overflow: "visible",
  },
  cardFace: {
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d4d4d8",
    backgroundColor: "#ffffff",
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBack: {
    padding: 0,
  },
  playableCard: {
    borderColor: "#22c55e",
    shadowColor: "#22c55e",
    shadowOpacity: 0.22,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  nonPlayableCard: {
    borderColor: "#94a3b8",
    backgroundColor: "#ffffff",
    shadowOpacity: 0.16,
  },
  selectedCard: {
    borderWidth: 2,
    borderColor: "#f59e0b",
    borderRadius: 8,
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 12,
  },
  cornerTL: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 2,
  },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  cornerBR: {
    position: "absolute",
    right: 0,
    bottom: 0,
    zIndex: 2,
    alignItems: "flex-end",
  },
  cornerAlignEnd: {
    textAlign: "right",
    alignSelf: "stretch",
  },
  rankText: {
    fontWeight: "800",
  },
  suitTextSmall: {
    fontWeight: "600",
    marginTop: 1,
  },
  suitTextCenter: {
    fontWeight: "700",
    textAlign: "center",
  },
});
