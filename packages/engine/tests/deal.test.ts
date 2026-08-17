import { describe, expect, it } from "vitest";

import { cardKey } from "../src/cards/card.js";
import { createTarokDeck, validateDeckCatalog } from "../src/cards/deck.js";
import { deal, UnsupportedPlayerCountError } from "../src/deal/deal.js";
import { createSeededRng } from "../src/rng/rng.js";
import { shuffle } from "../src/shuffle/shuffle.js";

describe("deal", () => {
  it("deals four hands of twelve cards and a talon of six cards", () => {
    validateDeckCatalog();

    const deck = shuffle(createTarokDeck(), createSeededRng(17));
    const result = deal(deck, { playerCount: 4 });

    expect(result.hands).toHaveLength(4);
    expect(result.hands.every((hand) => hand.length === 12)).toBe(true);
    expect(result.talon).toHaveLength(6);
  });

  it("does not lose or duplicate cards", () => {
    const deck = shuffle(createTarokDeck(), createSeededRng(21));
    const result = deal(deck, { playerCount: 4 });

    const dealtKeys = [
      ...result.hands.flatMap((hand) => hand.map(cardKey)),
      ...result.talon.map(cardKey),
    ];

    expect(dealtKeys).toHaveLength(deck.length);
    expect(new Set(dealtKeys).size).toBe(deck.length);
    expect(dealtKeys.sort()).toEqual(deck.map(cardKey).sort());
  });

  it("is deterministic for a seeded shuffle", () => {
    const firstDeck = shuffle(createTarokDeck(), createSeededRng(999));
    const secondDeck = shuffle(createTarokDeck(), createSeededRng(999));

    const firstDeal = deal(firstDeck, { playerCount: 4 });
    const secondDeal = deal(secondDeck, { playerCount: 4 });

    expect(firstDeal.hands.map((hand) => hand.map(cardKey))).toEqual(
      secondDeal.hands.map((hand) => hand.map(cardKey)),
    );
    expect(firstDeal.talon.map(cardKey)).toEqual(secondDeal.talon.map(cardKey));
  });

  it("uses round-robin dealing order", () => {
    const deck = shuffle(createTarokDeck(), createSeededRng(3));
    const result = deal(deck, { playerCount: 4 });

    for (let index = 0; index < 48; index += 1) {
      const playerIndex = index % 4;
      const cardIndex = Math.floor(index / 4);
      expect(result.hands[playerIndex]?.[cardIndex]).toEqual(deck[index]);
    }

    expect(result.talon).toEqual(deck.slice(48));
  });

  it("accepts a player count at the API boundary and rejects unsupported layouts", () => {
    expect(() => deal(createTarokDeck(), { playerCount: 3 })).toThrow(
      UnsupportedPlayerCountError,
    );
  });
});
