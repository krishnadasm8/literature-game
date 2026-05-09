import React, { useMemo, useState } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";

import type { Card } from "@shared/src";

import { CardView } from "./CardView";

interface HandViewProps {
  hand: Card[];
  playableCards: Card[];
  onCardSelect: (card: Card) => void;
}

const MAX_NON_SCROLLABLE = 8;

const cardCode = (card: Card): string => `${card.rank}-${card.suit}`;

export function HandView({ hand, playableCards, onCardSelect }: HandViewProps): JSX.Element {
  const { width } = useWindowDimensions();
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const overlap = width < 390 ? -28 : -22;

  const playableSet = useMemo(() => {
    return new Set(playableCards.map((card) => cardCode(card)));
  }, [playableCards]);

  const rotationForIndex = (index: number, total: number): string => {
    const center = (total - 1) / 2;
    const offset = index - center;
    const clamped = Math.max(-4, Math.min(4, offset));
    return `${clamped * 3}deg`;
  };

  const renderCard = (card: Card, index: number, total: number): JSX.Element => {
    const code = cardCode(card);
    const selected = selectedCode === code;
    const playable = playableSet.has(code);
    return (
      <View
        key={`${code}-${index}`}
        style={[
          styles.cardWrap,
          {
            marginLeft: index === 0 ? 0 : overlap,
            transform: [
              { rotate: rotationForIndex(index, total) },
              { translateY: Math.abs(index - (total - 1) / 2) * 1.8 },
            ],
          },
        ]}
      >
        <CardView
          card={card}
          faceUp
          selected={selected}
          playable={playable}
          onPress={() => {
            setSelectedCode((current) => (current === code ? null : code));
            onCardSelect(card);
          }}
        />
      </View>
    );
  };

  if (hand.length > MAX_NON_SCROLLABLE) {
    return (
      <FlatList
        horizontal
        data={hand}
        keyExtractor={(item, index) => `${cardCode(item)}-${index}`}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContainer}
        renderItem={({ item, index }) => (
          <View style={[styles.cardWrap, { marginLeft: index === 0 ? 0 : width < 390 ? -26 : -20 }]}>
            <CardView
              card={item}
              faceUp
              selected={selectedCode === cardCode(item)}
              playable={playableSet.has(cardCode(item))}
              onPress={() => {
                const code = cardCode(item);
                setSelectedCode((current) => (current === code ? null : code));
                onCardSelect(item);
              }}
            />
          </View>
        )}
      />
    );
  }

  return (
    <View style={styles.container}>
      {hand.map((card, index) => renderCard(card, index, hand.length))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  cardWrap: {
    alignItems: "center",
  },
  scrollContainer: {
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
});
