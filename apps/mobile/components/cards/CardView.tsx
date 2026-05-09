import React, { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
}

const SUIT_SYMBOLS: Record<Card["suit"], string> = {
  [Suit.SPADES]: "♠",
  [Suit.HEARTS]: "♥",
  [Suit.DIAMONDS]: "♦",
  [Suit.CLUBS]: "♣",
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

export function CardView({ card, faceUp, selected, playable, onPress }: CardViewProps): JSX.Element {
  const isRedSuit = useMemo(
    () => card.suit === Suit.HEARTS || card.suit === Suit.DIAMONDS,
    [card.suit],
  );
  const scale = useSharedValue(1);
  const lift = useSharedValue(selected ? -12 : 0);

  useEffect(() => {
    lift.value = withSpring(selected ? -12 : 0, {
      damping: 14,
      stiffness: 180,
    });
  }, [lift, selected]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }, { scale: scale.value }],
  }));

  const symbol = SUIT_SYMBOLS[card.suit];
  const rank = RANK_LABELS[card.rank];

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
              styles.card,
              playable && styles.playableCard,
              !playable && styles.nonPlayableCard,
              selected && styles.selectedCard,
            ]}
          >
            <View>
              <Text style={[styles.cornerText, isRedSuit ? styles.red : styles.black]}>{rank}</Text>
              <Text style={[styles.cornerText, isRedSuit ? styles.red : styles.black]}>{symbol}</Text>
            </View>
            <Text style={[styles.centerSymbol, isRedSuit ? styles.red : styles.black]}>{symbol}</Text>
            <View style={styles.bottomCorner}>
              <Text style={[styles.cornerText, isRedSuit ? styles.red : styles.black]}>{rank}</Text>
              <Text style={[styles.cornerText, isRedSuit ? styles.red : styles.black]}>{symbol}</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.cardBack, selected && styles.selectedCard]}>
            <CardBack width={52} height={76} />
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    borderRadius: 8,
  },
  card: {
    width: 52,
    height: 76,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#d4d4d8",
    backgroundColor: "#ffffff",
    padding: 5,
    justifyContent: "space-between",
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
  },
  cardBack: {
    overflow: "hidden",
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
    borderColor: "#f59e0b",
  },
  cornerText: {
    fontSize: 9,
    fontWeight: "800",
    lineHeight: 11,
  },
  centerSymbol: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "800",
  },
  bottomCorner: {
    alignSelf: "flex-end",
    transform: [{ rotate: "180deg" }],
  },
  red: {
    color: "#dc2626",
  },
  black: {
    color: "#111827",
  },
});
