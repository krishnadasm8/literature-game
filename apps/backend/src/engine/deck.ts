export type Suit = "HEARTS" | "DIAMONDS" | "CLUBS" | "SPADES";
export type Rank =
  | "TWO"
  | "THREE"
  | "FOUR"
  | "FIVE"
  | "SIX"
  | "SEVEN"
  | "NINE"
  | "TEN"
  | "JACK"
  | "QUEEN"
  | "KING"
  | "ACE";
export type HalfSuit =
  | "LOW_HEARTS"
  | "HIGH_HEARTS"
  | "LOW_DIAMONDS"
  | "HIGH_DIAMONDS"
  | "LOW_CLUBS"
  | "HIGH_CLUBS"
  | "LOW_SPADES"
  | "HIGH_SPADES";

export interface Card {
  suit: Suit;
  rank: Rank;
  halfSuit: HalfSuit;
}

export interface DealResult {
  hands: Record<string, Card[]>;
  remainingDeck: Card[];
}

const SUITS: Suit[] = ["HEARTS", "DIAMONDS", "CLUBS", "SPADES"];
const RANKS: Rank[] = [
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "NINE",
  "TEN",
  "JACK",
  "QUEEN",
  "KING",
  "ACE",
];
const LOW_RANKS = new Set<Rank>(["TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN"]);

const HALF_SUIT_ORDER: HalfSuit[] = [
  "LOW_HEARTS",
  "HIGH_HEARTS",
  "LOW_DIAMONDS",
  "HIGH_DIAMONDS",
  "LOW_CLUBS",
  "HIGH_CLUBS",
  "LOW_SPADES",
  "HIGH_SPADES",
];

const RANK_ORDER: Rank[] = [
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "NINE",
  "TEN",
  "JACK",
  "QUEEN",
  "KING",
  "ACE",
];

const RANK_DISPLAY: Record<Rank, string> = {
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
};

const CODE_TO_RANK: Record<string, Rank> = {
  "2": "TWO",
  "3": "THREE",
  "4": "FOUR",
  "5": "FIVE",
  "6": "SIX",
  "7": "SEVEN",
  "9": "NINE",
  "10": "TEN",
  J: "JACK",
  Q: "QUEEN",
  K: "KING",
  A: "ACE",
};

const SUIT_DISPLAY: Record<Suit, string> = {
  HEARTS: "Hearts",
  DIAMONDS: "Diamonds",
  CLUBS: "Clubs",
  SPADES: "Spades",
};

const CODE_TO_SUIT: Record<string, Suit> = {
  H: "HEARTS",
  D: "DIAMONDS",
  C: "CLUBS",
  S: "SPADES",
};

const RANK_TO_WORD: Record<Rank, string> = {
  TWO: "2",
  THREE: "3",
  FOUR: "4",
  FIVE: "5",
  SIX: "6",
  SEVEN: "7",
  NINE: "9",
  TEN: "10",
  JACK: "Jack",
  QUEEN: "Queen",
  KING: "King",
  ACE: "Ace",
};

const getHalfSuit = (suit: Suit, rank: Rank): HalfSuit => {
  const tier = LOW_RANKS.has(rank) ? "LOW" : "HIGH";
  return `${tier}_${suit}` as HalfSuit;
};

export const createDeck = (): Card[] => {
  const cards: Card[] = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        suit,
        rank,
        halfSuit: getHalfSuit(suit, rank),
      });
    }
  }

  return cards;
};

export const shuffleDeck = (deck: Card[], randomFn: () => number = Math.random): Card[] => {
  const shuffled = [...deck];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
};

export const dealCards = (deck: Card[], playerCount: number): DealResult => {
  if (![4, 6, 8].includes(playerCount)) {
    throw new Error("Literature only supports 4, 6, or 8 players.");
  }

  if (deck.length % playerCount !== 0) {
    throw new Error("Deck size must be divisible by player count.");
  }

  const hands = Object.fromEntries(
    Array.from({ length: playerCount }, (_, playerIndex) => [String(playerIndex), [] as Card[]]),
  );

  for (let i = 0; i < deck.length; i += 1) {
    const playerKey = String(i % playerCount);
    hands[playerKey].push(deck[i]);
  }

  return {
    hands,
    remainingDeck: [],
  };
};

export const getHalfSuitCards = (halfSuit: HalfSuit): Card[] => {
  return createDeck().filter((card) => card.halfSuit === halfSuit);
};

export const cardToString = (card: Card): string => {
  return `${RANK_TO_WORD[card.rank]} of ${SUIT_DISPLAY[card.suit]}`;
};

export const cardToCode = (card: Card): string => {
  const suitCode = Object.keys(CODE_TO_SUIT).find((code) => CODE_TO_SUIT[code] === card.suit);
  if (!suitCode) {
    throw new Error("Unsupported suit.");
  }
  return `${RANK_DISPLAY[card.rank]}${suitCode}`;
};

export const codeToCard = (code: string): Card => {
  const normalized = code.trim().toUpperCase();
  const match = normalized.match(/^(10|[2-79JQKA])([HDCS])$/);

  if (!match) {
    throw new Error(`Invalid card code: ${code}`);
  }

  const [, rankToken, suitToken] = match;
  const rank = CODE_TO_RANK[rankToken];
  const suit = CODE_TO_SUIT[suitToken];

  if (!rank || !suit) {
    throw new Error(`Invalid card code: ${code}`);
  }

  return {
    suit,
    rank,
    halfSuit: getHalfSuit(suit, rank),
  };
};

export const sortHand = (hand: Card[]): Card[] => {
  return [...hand].sort((a, b) => {
    const byHalfSuit = HALF_SUIT_ORDER.indexOf(a.halfSuit) - HALF_SUIT_ORDER.indexOf(b.halfSuit);
    if (byHalfSuit !== 0) {
      return byHalfSuit;
    }
    return RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank);
  });
};
