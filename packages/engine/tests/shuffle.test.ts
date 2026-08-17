import { describe, expect, it } from "vitest";

import { cardKey, isTarokCard } from "../src/cards/card.js";
import { createTarokDeck, validateDeckCatalog } from "../src/cards/deck.js";
import { createSeededRng } from "../src/rng/rng.js";
import { shuffle } from "../src/shuffle/shuffle.js";
import { getTrulaCards } from "../src/cards/trula.js";

describe("shuffle", () => {
  it("returns a permutation of the input deck", () => {
    const deck = createTarokDeck();
    const shuffled = shuffle(deck, createSeededRng(7));

    expect(shuffled).toHaveLength(deck.length);

    const originalKeys = deck.map(cardKey).sort();
    const shuffledKeys = shuffled.map(cardKey).sort();

    expect(shuffledKeys).toEqual(originalKeys);
  });

  it("does not mutate the input deck", () => {
    const deck = createTarokDeck();
    const snapshot = deck.map(cardKey);
    shuffle(deck, createSeededRng(11));

    expect(deck.map(cardKey)).toEqual(snapshot);
  });

  it("is deterministic for a seeded rng", () => {
    const deck = createTarokDeck();
    const first = shuffle(deck, createSeededRng(123));
    const second = shuffle(deck, createSeededRng(123));

    expect(first.map(cardKey)).toEqual(second.map(cardKey));
  });

  it("preserves the Trula cards", () => {
    validateDeckCatalog();

    const deck = createTarokDeck();
    const shuffled = shuffle(deck, createSeededRng(5));
    const trulaNames = getTrulaCards(shuffled)
      .filter(isTarokCard)
      .map((card) => card.name)
      .sort();

    expect(trulaNames).toEqual(["mond", "pagat", "skis"]);
  });
});
