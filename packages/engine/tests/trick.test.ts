import { describe, expect, it } from "vitest";

import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import { addPlay, createTrick } from "../src/trick/trick.js";

const pagat = TAROK_CATALOG.find((card) => card.name === "pagat")!;
const mond = TAROK_CATALOG.find((card) => card.name === "mond")!;

describe("trick model", () => {
  it("creates an empty trick led by the supplied player", () => {
    expect(createTrick(2)).toEqual({ leader: 2, plays: [] });
  });

  it("appends plays in order without mutating the previous trick", () => {
    const emptyTrick = createTrick(0);
    const firstPlay = addPlay(emptyTrick, { playerId: 0, card: pagat });
    const secondPlay = addPlay(firstPlay, { playerId: 1, card: mond });

    expect(emptyTrick.plays).toEqual([]);
    expect(firstPlay.plays).toEqual([{ playerId: 0, card: pagat }]);
    expect(secondPlay.plays).toEqual([
      { playerId: 0, card: pagat },
      { playerId: 1, card: mond },
    ]);
  });

  it("rejects a second play by the same player", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: pagat });

    expect(() => addPlay(trick, { playerId: 0, card: mond })).toThrow(
      "Player 0 has already played in this trick",
    );
  });

  it("rejects the same physical card twice", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: pagat });

    expect(() => addPlay(trick, { playerId: 1, card: pagat })).toThrow(
      "has already been played in this trick",
    );
  });
});
