import type { Suit, SuitRank } from "./suit.js";

export const NUMBERED_TAROK_NAMES = {
  1: "pagat",
  2: "ii",
  3: "iii",
  4: "iv",
  5: "v",
  6: "vi",
  7: "vii",
  8: "viii",
  9: "ix",
  10: "x",
  11: "xi",
  12: "xii",
  13: "xiii",
  14: "xiv",
  15: "xv",
  16: "xvi",
  17: "xvii",
  18: "xviii",
  19: "xix",
  20: "xx",
  21: "mond",
} as const;

export type NumberedTarokRank = keyof typeof NUMBERED_TAROK_NAMES;

export type TarokName =
  | (typeof NUMBERED_TAROK_NAMES)[NumberedTarokRank]
  | "skis";

/**
 * A union tied to the catalog mapping, so rank 1 can only be Pagat and rank
 * 21 can only be Mond (and likewise for every numbered tarok).
 */
export type NumberedTarokCard = {
  [Rank in NumberedTarokRank]: {
    kind: "tarok";
    rank: Rank;
    name: (typeof NUMBERED_TAROK_NAMES)[Rank];
  };
}[NumberedTarokRank];

export type SkisTarokCard = {
  kind: "tarok";
  rank: "skis";
  name: "skis";
};

export type TarokCard = NumberedTarokCard | SkisTarokCard;

export type SuitCard = {
  kind: "suit";
  suit: Suit;
  rank: SuitRank;
};

export type Card = TarokCard | SuitCard;

export function isTarokCard(card: Card): card is TarokCard {
  return card.kind === "tarok";
}

export function isSuitCard(card: Card): card is SuitCard {
  return card.kind === "suit";
}

export function cardsEqual(a: Card, b: Card): boolean {
  if (a.kind !== b.kind) {
    return false;
  }

  if (a.kind === "tarok" && b.kind === "tarok") {
    return a.rank === b.rank && a.name === b.name;
  }

  if (a.kind === "suit" && b.kind === "suit") {
    return a.suit === b.suit && a.rank === b.rank;
  }

  return false;
}

export function cardKey(card: Card): string {
  if (card.kind === "tarok") {
    return `tarok:${String(card.rank)}:${card.name}`;
  }

  return `suit:${card.suit}:${card.rank}`;
}
