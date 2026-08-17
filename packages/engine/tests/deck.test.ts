import { describe, expect, it } from "vitest";

import {
  cardKey,
  isSuitCard,
  isTarokCard,
} from "../src/cards/card.js";
import { SUIT_RANKS_BY_SUIT, SUITS } from "../src/cards/suit.js";
import {
  EXPECTED_DECK_SIZE,
  EXPECTED_SUIT_COUNT,
  EXPECTED_TAROK_COUNT,
  createTarokDeck,
  validateDeckCatalog,
} from "../src/cards/deck.js";
import {
  EXPECTED_SUIT_CATALOG_SIZE,
  SUIT_CATALOG,
} from "../src/cards/suit-catalog.js";
import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import { getTrulaCards, TRULA_NAMES } from "../src/cards/trula.js";

describe("deck catalog", () => {
  it("validates the catalog explicitly without import-time side effects", () => {
    const result = validateDeckCatalog();
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("contains exactly 54 cards", () => {
    const deck = createTarokDeck();
    expect(deck).toHaveLength(EXPECTED_DECK_SIZE);
  });

  it("contains exactly 22 taroks and 32 suit cards", () => {
    const deck = createTarokDeck();
    const taroks = deck.filter(isTarokCard);
    const suits = deck.filter(isSuitCard);

    expect(taroks).toHaveLength(EXPECTED_TAROK_COUNT);
    expect(suits).toHaveLength(EXPECTED_SUIT_COUNT);
  });

  it("contains no duplicate cards", () => {
    const deck = createTarokDeck();
    const keys = deck.map(cardKey);
    expect(new Set(keys).size).toBe(deck.length);
  });

  it("defines explicit catalogs of the expected sizes", () => {
    expect(TAROK_CATALOG).toHaveLength(EXPECTED_TAROK_COUNT);
    expect(SUIT_CATALOG).toHaveLength(EXPECTED_SUIT_CATALOG_SIZE);
  });

  it("contains the correct eight ranks for every suit", () => {
    const deck = createTarokDeck();

    for (const suit of SUITS) {
      const ranks = deck
        .filter((card) => isSuitCard(card) && card.suit === suit)
        .map((card) => card.rank)
        .sort();

      expect(ranks).toEqual([...SUIT_RANKS_BY_SUIT[suit]].sort());
    }
  });

  it("contains exactly one Pagat as Tarok I", () => {
    const deck = createTarokDeck();
    const pagatCards = deck.filter(
      (card) => isTarokCard(card) && card.name === "pagat",
    );

    expect(pagatCards).toHaveLength(1);
    expect(pagatCards[0]).toMatchObject({ rank: 1, name: "pagat" });
  });

  it("contains exactly one Mond as Tarok XXI", () => {
    const deck = createTarokDeck();
    const mondCards = deck.filter(
      (card) => isTarokCard(card) && card.name === "mond",
    );

    expect(mondCards).toHaveLength(1);
    expect(mondCards[0]).toMatchObject({ rank: 21, name: "mond" });
  });

  it("contains exactly one Škis distinct from Pagat", () => {
    const deck = createTarokDeck();
    const skisCards = deck.filter(
      (card) => isTarokCard(card) && card.rank === "skis",
    );
    const pagatCards = deck.filter(
      (card) => isTarokCard(card) && card.name === "pagat",
    );

    expect(skisCards).toHaveLength(1);
    expect(skisCards[0]).toMatchObject({ rank: "skis", name: "skis" });
    expect(cardKey(skisCards[0]!)).not.toEqual(cardKey(pagatCards[0]!));
  });

  it("contains a Trula of exactly Pagat, Mond and Škis", () => {
    const deck = createTarokDeck();
    const trulaCards = getTrulaCards(deck);

    expect(trulaCards).toHaveLength(TRULA_NAMES.length);
    expect(trulaCards.map((card) => card.name).sort()).toEqual(
      [...TRULA_NAMES].sort(),
    );
  });
});
