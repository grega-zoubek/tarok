import { describe, it, expect } from "vitest";
import { calculateGameScore } from "../../src/scoring/game-scoring.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import type { GameState } from "../../src/state/state.js";
import type { TrickRound } from "../../src/game/trick-round.js";
import { countPoints } from "../../src/scoring/scoring.js";

function createMockFinishedGameState(): GameState {
  const deck = createTarokDeck();
  const declarerHand = deck.slice(0, 12);
  const def1 = deck.slice(12, 24);
  const def2 = deck.slice(24, 36);
  const def3 = deck.slice(36, 48);
  const talon = deck.slice(48, 54);

  // Declarer takes first 3 talon cards, leaves 3
  const discarded = talon.slice(0, 3);
  const unpicked = talon.slice(3, 6);

  // Let's manually construct trick captures
  // Declarer wins the first trick with 4 cards
  // Defenders win the rest.
  const trickRound: TrickRound = {
    playerOrder: [0, 1, 2, 3],
    hands: [],
    currentTrick: { leader: 0, plays: [] },
    capturedTricks: [
      {
        winner: 0, // Declarer
        trick: {
          leader: 0,
          plays: [
            { playerId: 0, card: declarerHand[0]! },
            { playerId: 1, card: def1[0]! },
            { playerId: 2, card: def2[0]! },
            { playerId: 3, card: def3[0]! },
          ],
        },
      },
      // Defenders (player 1) wins everything else
      {
        winner: 1,
        trick: {
          leader: 1,
          plays: [
            { playerId: 1, card: def1[1]! },
            { playerId: 2, card: def2[1]! },
            { playerId: 3, card: def3[1]! },
            { playerId: 0, card: declarerHand[1]! },
          ],
        },
      },
    ],
  };

  return {
    phase: "finished",
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    currentPlayer: undefined,
    hands: { 0: [], 1: [], 2: [], 3: [] },
    talon,
    bids: [],
    passedPlayers: [],
    contract: "tri",
    declarer: 0,
    calledKing: undefined, // Plays alone
    teams: {
      declarerTeam: [0],
      defendingTeam: [1, 2, 3],
    },
    announcementsRound: undefined,
    pickedTalonGroupIndex: 0,
    discardedCards: discarded,
    trickRound,
  };
}

describe("Game Scoring", () => {
  it("throws if the game is not finished", () => {
    const state = createMockFinishedGameState();
    const playingState = { ...state, phase: "playing" } as GameState;
    expect(() => calculateGameScore(playingState)).toThrowError();
  });

  it("calculates exact points for declarer and defending team", () => {
    const state = createMockFinishedGameState();
    const result = calculateGameScore(state);

    expect(result.declarerTeam.collectedCards.length).toBe(7); // 4 from trick, 3 from discard
    // Uncollected talon goes to defenders
    expect(result.uncollectedCards.length).toBe(3);
    expect(result.defendingTeam.collectedCards.length).toBe(7); // 4 from trick, 3 unpicked talon

    // Let's verify sum of points
    const decPts = countPoints(result.declarerTeam.collectedCards);
    const defPts = countPoints(result.defendingTeam.collectedCards);
    
    expect(result.declarerTeam.cardPoints).toBe(decPts);
    expect(result.defendingTeam.cardPoints).toBe(defPts);
    
    // Total should equal countPoints of all those 14 cards (this might not be exactly 70 because we only used a subset of deck for tricks)
    expect(result.isWin).toBe(decPts > 35);
  });
});
