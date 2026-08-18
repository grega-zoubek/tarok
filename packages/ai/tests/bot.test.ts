import { describe, it, expect } from "vitest";
import { RandomBot } from "../src/bot/random-bot.js";
import { createTrickRound, createInitialGameState, type Card } from "@tarok/engine";

describe("RandomBot", () => {
  it("initializes with the correct playerId", () => {
    const bot = new RandomBot(2);
    expect(bot.playerId).toBe(2);
  });

  it("passes bidding", () => {
    const bot = new RandomBot(0);
    const mockState = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: { 0: [], 1: [], 2: [], 3: [] },
      initialTalon: [],
    });
    
    expect(bot.chooseBid(mockState)).toBe("naprej");
  });

  it("selects a valid random play from legal plays", () => {
    const bot = new RandomBot(1);
    
    // Mock a state
    const hand: Card[] = [
      { kind: "suit", suit: "hearts", rank: "king" },
      { kind: "tarok", rank: 1, name: "pagat" }
    ];
    
    const mockState = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: { 0: [], 1: hand, 2: [], 3: [] },
      initialTalon: [],
    });

    const activeState = {
      ...mockState,
      trickRound: createTrickRound({
        playerOrder: [0, 1, 2, 3],
        hands: [{ playerId: 1, cards: hand }, { playerId: 0, cards: [] }, { playerId: 2, cards: [] }, { playerId: 3, cards: [] }],
        leader: 1
      })
    };

    const chosenCard = bot.choosePlay(activeState as any, hand);
    expect(hand.some(c => c === chosenCard)).toBe(true);
  });

  it("discards non-valuable cards", () => {
    const bot = new RandomBot(0);
    const mockState = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: { 0: [], 1: [], 2: [], 3: [] },
      initialTalon: [],
    });

    const hand: Card[] = [
      { kind: "suit", suit: "hearts", rank: "king" }, // 5 points, can't discard
      { kind: "tarok", rank: 1, name: "pagat" }, // Trula, can't discard
      { kind: "suit", suit: "spades", rank: "jack" }, // Valid discard
      { kind: "tarok", rank: 10, name: "x" } // Valid discard, but suit preferred
    ];

    const discards = bot.chooseDiscards(mockState, hand, 1);
    expect(discards.length).toBe(1);
    expect(discards[0]).toEqual({ kind: "suit", suit: "spades", rank: "jack" }); // Prefers suit cards
  });
});
