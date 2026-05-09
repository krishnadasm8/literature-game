import { HalfSuit, Rank, Suit, type Card } from "@shared/src";

const RANK_ORDER: Rank[] = [
  Rank.TWO,
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
  Rank.NINE,
  Rank.TEN,
  Rank.JACK,
  Rank.QUEEN,
  Rank.KING,
  Rank.ACE,
];

const SUIT_ORDER: Suit[] = [Suit.CLUBS, Suit.DIAMONDS, Suit.HEARTS, Suit.SPADES];
const LOW_RANKS = new Set<Rank>([
  Rank.TWO,
  Rank.THREE,
  Rank.FOUR,
  Rank.FIVE,
  Rank.SIX,
  Rank.SEVEN,
]);

const SUIT_SYMBOL_MAP: Record<Suit, string> = {
  [Suit.CLUBS]: "♣",
  [Suit.DIAMONDS]: "♦",
  [Suit.HEARTS]: "♥",
  [Suit.SPADES]: "♠",
};

const RANK_LABEL_MAP: Record<Rank, string> = {
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

export const getHalfSuit = (suit: Suit, rank: Rank): HalfSuit => {
  if (LOW_RANKS.has(rank)) {
    if (suit === Suit.HEARTS) return HalfSuit.LOW_HEARTS;
    if (suit === Suit.DIAMONDS) return HalfSuit.LOW_DIAMONDS;
    if (suit === Suit.CLUBS) return HalfSuit.LOW_CLUBS;
    return HalfSuit.LOW_SPADES;
  }

  if (suit === Suit.HEARTS) return HalfSuit.HIGH_HEARTS;
  if (suit === Suit.DIAMONDS) return HalfSuit.HIGH_DIAMONDS;
  if (suit === Suit.CLUBS) return HalfSuit.HIGH_CLUBS;
  return HalfSuit.HIGH_SPADES;
};

export const cardToString = (card: Card): string => {
  return `${RANK_LABEL_MAP[card.rank]}${SUIT_SYMBOL_MAP[card.suit]}`;
};

export const sortHand = (hand: Card[]): Card[] => {
  const suitIndex = (suit: Suit): number => SUIT_ORDER.indexOf(suit);
  const rankIndex = (rank: Rank): number => RANK_ORDER.indexOf(rank);

  return [...hand].sort((a, b) => {
    const bySuit = suitIndex(a.suit) - suitIndex(b.suit);
    if (bySuit !== 0) {
      return bySuit;
    }

    return rankIndex(a.rank) - rankIndex(b.rank);
  });
};
