import { describe, it, expect } from "vitest";
import {
  getBarvniValatLegalPlays,
  getBarvniValatTrickWinner,
  getTrickWinner,
  addPlay,
  createTrick,
} from "../../src/trick/trick.js";
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

describe("Barvni valat trick winner (taroks are not trumps)", () => {
  it("suit lead: highest of led suit wins even if škis is played", () => {
    let trick = createTrick(0);
    trick = addPlay(trick, { playerId: 0, card: { kind: "suit", suit: "hearts", rank: "jack" } });
    trick = addPlay(trick, { playerId: 1, card: { kind: "suit", suit: "hearts", rank: "king" } });
    trick = addPlay(trick, { playerId: 2, card: { kind: "tarok", rank: "skis", name: "skis" } });
    trick = addPlay(trick, { playerId: 3, card: { kind: "suit", suit: "clubs", rank: "seven" } });

    expect(getBarvniValatTrickWinner(trick).playerId).toBe(1);
    // Normal rules would give it to škis
    expect(getTrickWinner(trick).playerId).toBe(2);
  });

  it("tarok lead: highest tarok wins", () => {
    let trick = createTrick(0);
    trick = addPlay(trick, { playerId: 0, card: { kind: "tarok", rank: 10, name: "x" } });
    trick = addPlay(trick, { playerId: 1, card: { kind: "suit", suit: "hearts", rank: "king" } });
    trick = addPlay(trick, { playerId: 2, card: { kind: "tarok", rank: 15, name: "xv" } });
    trick = addPlay(trick, { playerId: 3, card: { kind: "suit", suit: "clubs", rank: "queen" } });

    expect(getBarvniValatTrickWinner(trick).playerId).toBe(2);
  });
});
