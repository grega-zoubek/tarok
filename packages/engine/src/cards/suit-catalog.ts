import type { SuitCard } from "./card.js";
import { SUIT_RANKS_BY_SUIT, SUITS } from "./suit.js";

export const SUIT_CATALOG: readonly SuitCard[] = [
  { kind: "suit", suit: "hearts", rank: "king" },
  { kind: "suit", suit: "hearts", rank: "queen" },
  { kind: "suit", suit: "hearts", rank: "cavalier" },
  { kind: "suit", suit: "hearts", rank: "jack" },
  { kind: "suit", suit: "hearts", rank: "ace" },
  { kind: "suit", suit: "hearts", rank: "two" },
  { kind: "suit", suit: "hearts", rank: "three" },
  { kind: "suit", suit: "hearts", rank: "four" },
  { kind: "suit", suit: "diamonds", rank: "king" },
  { kind: "suit", suit: "diamonds", rank: "queen" },
  { kind: "suit", suit: "diamonds", rank: "cavalier" },
  { kind: "suit", suit: "diamonds", rank: "jack" },
  { kind: "suit", suit: "diamonds", rank: "ace" },
  { kind: "suit", suit: "diamonds", rank: "two" },
  { kind: "suit", suit: "diamonds", rank: "three" },
  { kind: "suit", suit: "diamonds", rank: "four" },
  { kind: "suit", suit: "clubs", rank: "king" },
  { kind: "suit", suit: "clubs", rank: "queen" },
  { kind: "suit", suit: "clubs", rank: "cavalier" },
  { kind: "suit", suit: "clubs", rank: "jack" },
  { kind: "suit", suit: "clubs", rank: "ten" },
  { kind: "suit", suit: "clubs", rank: "nine" },
  { kind: "suit", suit: "clubs", rank: "eight" },
  { kind: "suit", suit: "clubs", rank: "seven" },
  { kind: "suit", suit: "spades", rank: "king" },
  { kind: "suit", suit: "spades", rank: "queen" },
  { kind: "suit", suit: "spades", rank: "cavalier" },
  { kind: "suit", suit: "spades", rank: "jack" },
  { kind: "suit", suit: "spades", rank: "ten" },
  { kind: "suit", suit: "spades", rank: "nine" },
  { kind: "suit", suit: "spades", rank: "eight" },
  { kind: "suit", suit: "spades", rank: "seven" },
];

/** Ensures the suit catalog stays aligned with the declared suit and rank sets. */
export const EXPECTED_SUIT_CATALOG_SIZE = SUITS.reduce(
  (count, suit) => count + SUIT_RANKS_BY_SUIT[suit].length,
  0,
);
