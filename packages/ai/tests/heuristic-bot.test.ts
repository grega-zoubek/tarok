import { describe, it, expect } from "vitest";
import { HeuristicBot } from "../src/bot/heuristic-bot.js";
import { createInitialGameState, createTrickRound, type Card, type GameState } from "@tarok/engine";

describe("HeuristicBot", () => {
  const dummyState = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    initialHands: { 0: [], 1: [], 2: [], 3: [] },
    initialTalon: [],
  });

  describe("Level 1 (Lowest)", () => {
    it("always passes bids", () => {
      const bot = new HeuristicBot(0, 1);
      expect(bot.chooseBid(dummyState)).toBe("naprej");
    });
  });

  describe("Level 4+ (Protecting Mond)", () => {
    it("avoids playing Mond if Škis is not played and it can play something else", () => {
      const bot = new HeuristicBot(1, 4);
      
      const hand: Card[] = [
        { kind: "tarok", rank: 21, name: "mond" },
        { kind: "tarok", rank: 10, name: "x" }
      ];

      const activeState = {
        ...dummyState,
        trickRound: createTrickRound({
          playerOrder: [0, 1, 2, 3],
          hands: [{ playerId: 1, cards: hand }, { playerId: 0, cards: [] }, { playerId: 2, cards: [] }, { playerId: 3, cards: [] }],
          leader: 0
        })
      };

      // Add a trick where a high card was played, making Tarok legal/forced
      activeState.trickRound.currentTrick.plays.push({
        playerId: 0,
        card: { kind: "tarok", rank: 15, name: "xv" }
      });

      const play = bot.choosePlay(activeState as GameState, hand);
      // It should play X, not Mond, because Škis hasn't been played yet!
      expect(play).toEqual({ kind: "tarok", rank: 10, name: "x" });
    });
  });

  describe("Level 5 (Partner Awareness & Schmear)", () => {
    it("plays a high point card if its partner is winning the trick", () => {
      const bot = new HeuristicBot(1, 5);
      
      const hand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "king" }, // 5 pts
        { kind: "suit", suit: "hearts", rank: "two" },  // 1 pt
      ];

      const activeState = {
        ...dummyState,
        teams: {
          declarerTeam: [0, 1], // Bot (1) is partner with 0
          defendingTeam: [2, 3]
        },
        trickRound: createTrickRound({
          playerOrder: [0, 1, 2, 3],
          hands: [{ playerId: 1, cards: hand }, { playerId: 0, cards: [] }, { playerId: 2, cards: [] }, { playerId: 3, cards: [] }],
          leader: 0
        })
      };

      // Partner (0) led with Škis! Guaranteed win.
      activeState.trickRound.currentTrick.plays.push({
        playerId: 0,
        card: { kind: "tarok", rank: "skis", name: "skis" }
      });

      // Bot (1) is forced to follow suit? No, Škis is tarok, but bot has no taroks! So it can play ANY card.
      // Bot should "schmear" the king to its partner.
      const play = bot.choosePlay(activeState as GameState, hand);
      expect(play).toEqual({ kind: "suit", suit: "hearts", rank: "king" });
    });
  });
});
