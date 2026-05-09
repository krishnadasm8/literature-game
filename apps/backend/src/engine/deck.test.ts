import { describe, expect, test } from "@jest/globals";

import {
  cardToCode,
  codeToCard,
  createDeck,
  dealCards,
  getHalfSuitCards,
  shuffleDeck,
  type HalfSuit,
} from "./deck";

describe("deck engine", () => {
  test("deck has exactly 48 cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(48);
  });

  test("deck has no eights", () => {
    const deck = createDeck();
    const hasEight = deck.some((card) => cardToCode(card).startsWith("8"));
    expect(hasEight).toBe(false);
  });

  test("each half-suit has exactly 6 cards", () => {
    const halfSuits: HalfSuit[] = [
      "LOW_HEARTS",
      "HIGH_HEARTS",
      "LOW_DIAMONDS",
      "HIGH_DIAMONDS",
      "LOW_CLUBS",
      "HIGH_CLUBS",
      "LOW_SPADES",
      "HIGH_SPADES",
    ];

    for (const halfSuit of halfSuits) {
      const cards = getHalfSuitCards(halfSuit);
      expect(cards).toHaveLength(6);
    }
  });

  test("deal gives correct card counts for 4, 6, 8 players", () => {
    const deck = createDeck();

    const deal4 = dealCards(deck, 4);
    expect(Object.keys(deal4.hands)).toHaveLength(4);
    for (const hand of Object.values(deal4.hands)) {
      expect(hand).toHaveLength(12);
    }
    expect(deal4.remainingDeck).toHaveLength(0);

    const deal6 = dealCards(deck, 6);
    expect(Object.keys(deal6.hands)).toHaveLength(6);
    for (const hand of Object.values(deal6.hands)) {
      expect(hand).toHaveLength(8);
    }
    expect(deal6.remainingDeck).toHaveLength(0);

    const deal8 = dealCards(deck, 8);
    expect(Object.keys(deal8.hands)).toHaveLength(8);
    for (const hand of Object.values(deal8.hands)) {
      expect(hand).toHaveLength(6);
    }
    expect(deal8.remainingDeck).toHaveLength(0);
  });

  test("shuffle returns different order", () => {
    const deck = createDeck();
    const shuffled = shuffleDeck(deck);
    const sameOrder = deck.every((card, index) => {
      const other = shuffled[index];
      return card.suit === other.suit && card.rank === other.rank;
    });
    expect(sameOrder).toBe(false);
  });

  test("cardToCode and codeToCard roundtrip", () => {
    const original = createDeck()[0];
    const code = cardToCode(original);
    const parsed = codeToCard(code);

    expect(parsed).toEqual(original);
  });
});
