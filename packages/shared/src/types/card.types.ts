export enum Suit {
  HEARTS = "HEARTS",
  DIAMONDS = "DIAMONDS",
  CLUBS = "CLUBS",
  SPADES = "SPADES",
}

export enum Rank {
  TWO = "TWO",
  THREE = "THREE",
  FOUR = "FOUR",
  FIVE = "FIVE",
  SIX = "SIX",
  SEVEN = "SEVEN",
  NINE = "NINE",
  TEN = "TEN",
  JACK = "JACK",
  QUEEN = "QUEEN",
  KING = "KING",
  ACE = "ACE",
}

export enum HalfSuit {
  LOW_HEARTS = "LOW_HEARTS",
  HIGH_HEARTS = "HIGH_HEARTS",
  LOW_DIAMONDS = "LOW_DIAMONDS",
  HIGH_DIAMONDS = "HIGH_DIAMONDS",
  LOW_CLUBS = "LOW_CLUBS",
  HIGH_CLUBS = "HIGH_CLUBS",
  LOW_SPADES = "LOW_SPADES",
  HIGH_SPADES = "HIGH_SPADES",
}

export interface Card {
  suit: Suit;
  rank: Rank;
  halfSuit: HalfSuit;
}
