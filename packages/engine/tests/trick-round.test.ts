import { describe, expect, it } from "vitest";

import { SUIT_CATALOG } from "../src/cards/suit-catalog.js";
import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import {
  beginNextTrick,
  createTrickRound,
  getCapturedTricks,
  getCurrentPlayer,
  isTrickComplete,
  playTurn,
  resolveTrick,
} from "../src/game/trick-round.js";

const heartQueen = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "queen",
)!;
const heartKing = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "king",
)!;
const clubKing = SUIT_CATALOG.find(
  (card) => card.suit === "clubs" && card.rank === "king",
)!;
const pagat = TAROK_CATALOG.find((card) => card.name === "pagat")!;

function createRound() {
  return createTrickRound({
    playerOrder: [0, 1, 2, 3],
    hands: [
      { playerId: 0, cards: [heartQueen] },
      { playerId: 1, cards: [heartKing] },
      { playerId: 2, cards: [clubKing] },
      { playerId: 3, cards: [pagat] },
    ],
    leader: 0,
  });
}

describe("trick round", () => {
  it("starts with the leader and advances through the explicit player order", () => {
    let round = createRound();
    expect(getCurrentPlayer(round)).toBe(0);

    round = playTurn(round, 0, heartQueen);
    expect(getCurrentPlayer(round)).toBe(1);

    round = playTurn(round, 1, heartKing);
    expect(getCurrentPlayer(round)).toBe(2);
  });

  it("removes the played card while preserving the previous state", () => {
    const round = createRound();
    const nextRound = playTurn(round, 0, heartQueen);

    expect(round.hands[0]?.cards).toEqual([heartQueen]);
    expect(nextRound.hands[0]?.cards).toEqual([]);
    expect(nextRound.currentTrick.plays).toEqual([
      { playerId: 0, card: heartQueen },
    ]);
  });

  it("rejects play out of turn", () => {
    const round = createRound();

    expect(() => playTurn(round, 1, heartKing)).toThrow(
      "It is player 0's turn, not player 1's",
    );
  });

  it("resolves a completed trick and makes its winner the next leader", () => {
    let round = createRound();
    round = playTurn(round, 0, heartQueen);
    round = playTurn(round, 1, heartKing);
    round = playTurn(round, 2, clubKing);
    round = playTurn(round, 3, pagat);

    expect(isTrickComplete(round)).toBe(true);
    expect(resolveTrick(round).winner).toBe(3);

    const nextRound = beginNextTrick(round);
    expect(nextRound.currentTrick).toEqual({ leader: 3, plays: [] });
    expect(getCurrentPlayer(nextRound)).toBe(3);
    expect(round.capturedTricks).toEqual([]);
    expect(getCapturedTricks(nextRound, 3)).toEqual([
      {
        winner: 3,
        trick: {
          leader: 0,
          plays: [
            { playerId: 0, card: heartQueen },
            { playerId: 1, card: heartKing },
            { playerId: 2, card: clubKing },
            { playerId: 3, card: pagat },
          ],
        },
      },
    ]);
  });
});
