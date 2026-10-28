import { describe, it, expect } from "vitest";
import { getBarvniValatLegalPlays, createTrick } from "../../src/trick/trick.js";
import type { Card } from "../../src/cards/card.js";

describe("Barvni valat legal plays", () => {
  const hand: Card[] = [
    { kind: "suit", suit: "hearts", rank: "king" },
    { kind: "suit", suit: "clubs", rank: "seven" },
    { kind: "tarok", rank: 10, name: "x" },
    { kind: "tarok", rank: "skis", name: "skis" },
  ];

  it("forbids leading tarok while holding suit cards", () => {
    const trick = createTrick(0);
    const legal = getBarvniValatLegalPlays(hand, trick);
    expect(legal.every((c) => c.kind === "suit")).toBe(true);
    expect(legal).toHaveLength(2);
  });

  it("allows leading tarok when hand is only taroks", () => {
    const tarokOnly = hand.filter((c) => c.kind === "tarok");
    const legal = getBarvniValatLegalPlays(tarokOnly, createTrick(0));
    expect(legal).toHaveLength(2);
  });
});
