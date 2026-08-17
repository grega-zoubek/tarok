export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;

export type Suit = (typeof SUITS)[number];

export const SUIT_RANKS = [
  "king",
  "queen",
  "cavalier",
  "jack",
  "ace",
  "two",
  "three",
  "four",
] as const;

export type SuitRank = (typeof SUIT_RANKS)[number];
