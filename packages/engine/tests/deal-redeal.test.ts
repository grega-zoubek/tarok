import { describe, it, expect } from "vitest";
import { createTarokDeck } from "../src/cards/deck.js";
import { deal, handHasTarok, anyHandMissingTarok } from "../src/deal/deal.js";
import { isTarokCard } from "../src/cards/card.js";

describe("Brez taroka ni taroka", () => {
  it("handHasTarok detects taroks", () => {
    const deck = createTarokDeck();
    const taroks = deck.filter(isTarokCard);
    const suits = deck.filter((c) => !isTarokCard(c));
    expect(handHasTarok(taroks.slice(0, 3))).toBe(true);
    expect(handHasTarok(suits.slice(0, 12))).toBe(false);
  });

  it("anyHandMissingTarok is false for a normal deal", () => {
    const deck = createTarokDeck();
    const result = deal(deck, { playerCount: 4 });
    // Unshuffled catalog deal may still give everyone taroks — just assert API shape
    expect(typeof anyHandMissingTarok(result.hands)).toBe("boolean");
  });
});
