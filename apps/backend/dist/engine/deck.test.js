"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const globals_1 = require("@jest/globals");
const deck_1 = require("./deck");
(0, globals_1.describe)("deck engine", () => {
    (0, globals_1.test)("deck has exactly 48 cards", () => {
        const deck = (0, deck_1.createDeck)();
        (0, globals_1.expect)(deck).toHaveLength(48);
    });
    (0, globals_1.test)("deck has no eights", () => {
        const deck = (0, deck_1.createDeck)();
        const hasEight = deck.some((card) => (0, deck_1.cardToCode)(card).startsWith("8"));
        (0, globals_1.expect)(hasEight).toBe(false);
    });
    (0, globals_1.test)("each half-suit has exactly 6 cards", () => {
        const halfSuits = [
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
            const cards = (0, deck_1.getHalfSuitCards)(halfSuit);
            (0, globals_1.expect)(cards).toHaveLength(6);
        }
    });
    (0, globals_1.test)("deal gives correct card counts for 4, 6, 8 players", () => {
        const deck = (0, deck_1.createDeck)();
        const deal4 = (0, deck_1.dealCards)(deck, 4);
        (0, globals_1.expect)(Object.keys(deal4.hands)).toHaveLength(4);
        for (const hand of Object.values(deal4.hands)) {
            (0, globals_1.expect)(hand).toHaveLength(12);
        }
        (0, globals_1.expect)(deal4.remainingDeck).toHaveLength(0);
        const deal6 = (0, deck_1.dealCards)(deck, 6);
        (0, globals_1.expect)(Object.keys(deal6.hands)).toHaveLength(6);
        for (const hand of Object.values(deal6.hands)) {
            (0, globals_1.expect)(hand).toHaveLength(8);
        }
        (0, globals_1.expect)(deal6.remainingDeck).toHaveLength(0);
        const deal8 = (0, deck_1.dealCards)(deck, 8);
        (0, globals_1.expect)(Object.keys(deal8.hands)).toHaveLength(8);
        for (const hand of Object.values(deal8.hands)) {
            (0, globals_1.expect)(hand).toHaveLength(6);
        }
        (0, globals_1.expect)(deal8.remainingDeck).toHaveLength(0);
    });
    (0, globals_1.test)("shuffle returns different order", () => {
        const deck = (0, deck_1.createDeck)();
        const shuffled = (0, deck_1.shuffleDeck)(deck);
        const sameOrder = deck.every((card, index) => {
            const other = shuffled[index];
            return card.suit === other.suit && card.rank === other.rank;
        });
        (0, globals_1.expect)(sameOrder).toBe(false);
    });
    (0, globals_1.test)("cardToCode and codeToCard roundtrip", () => {
        const original = (0, deck_1.createDeck)()[0];
        const code = (0, deck_1.cardToCode)(original);
        const parsed = (0, deck_1.codeToCard)(code);
        (0, globals_1.expect)(parsed).toEqual(original);
    });
});
