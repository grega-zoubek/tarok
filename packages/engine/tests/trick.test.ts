import { describe, expect, it } from "vitest";

import { SUIT_CATALOG } from "../src/cards/suit-catalog.js";
import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import { addPlay, createTrick, getTrickWinner } from "../src/trick/trick.js";

const pagat = TAROK_CATALOG.find((card) => card.name === "pagat")!;
const mond = TAROK_CATALOG.find((card) => card.name === "mond")!;
const skis = TAROK_CATALOG.find((card) => card.name === "skis")!;
const tarokXx = TAROK_CATALOG.find((card) => card.name === "xx")!;
const heartKing = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "king",
)!;
const heartQueen = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "queen",
)!;
const clubKing = SUIT_CATALOG.find(
  (card) => card.suit === "clubs" && card.rank === "king",
)!;
const clubTen = SUIT_CATALOG.find(
  (card) => card.suit === "clubs" && card.rank === "ten",
)!;
const clubSeven = SUIT_CATALOG.find(
  (card) => card.suit === "clubs" && card.rank === "seven",
)!;

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

  it("requires the leader to make the first play", () => {
    expect(() => addPlay(createTrick(0), { playerId: 1, card: pagat })).toThrow(
      "The first play must be made by leader 0",
    );
  });

  it("rejects the same physical card twice", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: pagat });

    expect(() => addPlay(trick, { playerId: 1, card: pagat })).toThrow(
      "has already been played in this trick",
    );
  });

  it("selects the highest card of the led suit when no tarok is played", () => {
    const trick = addPlay(
      addPlay(createTrick(0), { playerId: 0, card: heartQueen }),
      { playerId: 1, card: heartKing },
    );
    const completedTrick = addPlay(trick, { playerId: 2, card: clubKing });

    expect(getTrickWinner(completedTrick)).toEqual({
      playerId: 1,
      card: heartKing,
    });
  });

  it("uses the black-suit order from ten down to seven", () => {
    const trick = addPlay(
      addPlay(createTrick(0), { playerId: 0, card: clubSeven }),
      { playerId: 1, card: clubTen },
    );

    expect(getTrickWinner(trick)).toEqual({ playerId: 1, card: clubTen });
  });

  it("selects the highest tarok over every suit card", () => {
    const trick = addPlay(
      addPlay(createTrick(0), { playerId: 0, card: heartKing }),
      { playerId: 1, card: pagat },
    );
    const completedTrick = addPlay(trick, { playerId: 2, card: mond });

    expect(getTrickWinner(completedTrick)).toEqual({ playerId: 2, card: mond });
  });

  it("applies the Emperor trick: Pagat wins when the full Trula is played", () => {
    const trick = addPlay(
      addPlay(createTrick(0), { playerId: 0, card: skis }),
      { playerId: 1, card: mond },
    );
    const completedTrick = addPlay(trick, { playerId: 2, card: pagat });

    expect(getTrickWinner(completedTrick)).toEqual({ playerId: 2, card: pagat });
  });

  it("rejects an empty trick", () => {
    expect(() => getTrickWinner(createTrick(0))).toThrow(
      "Cannot determine a winner for an empty trick",
    );
  });
});
