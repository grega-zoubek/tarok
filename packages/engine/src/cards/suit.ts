export const SUITS = ["hearts", "diamonds", "clubs", "spades"] as const;

export type Suit = (typeof SUITS)[number];

export const RED_SUITS = ["hearts", "diamonds"] as const;

export type RedSuit = (typeof RED_SUITS)[number];

export const BLACK_SUITS = ["clubs", "spades"] as const;

export type BlackSuit = (typeof BLACK_SUITS)[number];

export const RED_SUIT_RANKS = [
  "king",
  "queen",
  "cavalier",
  "jack",
  "ace",
  "two",
  "three",
  "four",
] as const;

export type RedSuitRank = (typeof RED_SUIT_RANKS)[number];

export const BLACK_SUIT_RANKS = [
  "king",
  "queen",
  "cavalier",
  "jack",
  "ten",
  "nine",
  "eight",
  "seven",
] as const;

export type BlackSuitRank = (typeof BLACK_SUIT_RANKS)[number];

export const SUIT_RANKS_BY_SUIT = {
  hearts: RED_SUIT_RANKS,
  diamonds: RED_SUIT_RANKS,
  clubs: BLACK_SUIT_RANKS,
  spades: BLACK_SUIT_RANKS,
} as const;

export type SuitRank = RedSuitRank | BlackSuitRank;

export type SuitRankFor<SuitName extends Suit> =
  (typeof SUIT_RANKS_BY_SUIT)[SuitName][number];
