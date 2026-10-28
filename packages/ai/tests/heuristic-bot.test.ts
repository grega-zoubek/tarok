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

  describe("Discards & raise", () => {
    it("prefers voiding a short suit when discarding (level 3+)", () => {
      const bot = new HeuristicBot(0, 4);
      const hand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "seven" },
        { kind: "suit", suit: "hearts", rank: "eight" },
        { kind: "suit", suit: "clubs", rank: "queen" },
        { kind: "suit", suit: "clubs", rank: "cavalier" },
        { kind: "suit", suit: "clubs", rank: "jack" },
        { kind: "suit", suit: "clubs", rank: "seven" },
        { kind: "tarok", rank: 10, name: "x" },
      ];
      const discards = bot.chooseDiscards(dummyState, hand, 2);
      expect(discards).toHaveLength(2);
      expect(discards.every((c) => c.kind === "suit" && c.suit === "hearts")).toBe(true);
    });

    it("does not raise to barvni valat on weak hands", () => {
      const bot = new HeuristicBot(0, 5);
      const state = {
        ...dummyState,
        contract: "solo_tri" as const,
        hands: {
          0: [
            { kind: "tarok", rank: "skis", name: "skis" },
            { kind: "tarok", rank: 21, name: "mond" },
            { kind: "tarok", rank: 15, name: "xv" },
            { kind: "tarok", rank: 10, name: "x" },
            { kind: "suit", suit: "hearts", rank: "king" },
            { kind: "suit", suit: "spades", rank: "seven" },
            { kind: "suit", suit: "clubs", rank: "eight" },
            { kind: "suit", suit: "diamonds", rank: "nine" },
          ] as Card[],
          1: [], 2: [], 3: [],
        },
      };
      expect(bot.chooseRaiseToBarvniValat(state as GameState)).toBe(false);
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
        // No calledKing → teams are public (solo / already known)
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

    it("does not use secret partner knowledge before called king is played", () => {
      const bot = new HeuristicBot(1, 5);
      const hand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "king" },
        { kind: "suit", suit: "hearts", rank: "two" },
      ];

      const activeState = {
        ...dummyState,
        calledKing: { suit: "spades" as const, rank: "king" as const },
        teams: {
          declarerTeam: [0, 1],
          defendingTeam: [2, 3],
        },
        trickRound: createTrickRound({
          playerOrder: [0, 1, 2, 3],
          hands: [
            { playerId: 1, cards: hand },
            { playerId: 0, cards: [] },
            { playerId: 2, cards: [] },
            { playerId: 3, cards: [] },
          ],
          leader: 0,
        }),
      };

      activeState.trickRound.currentTrick.plays.push({
        playerId: 0,
        card: { kind: "tarok", rank: "skis", name: "skis" },
      });

      // Without knowing 0 is partner, bot should dump the low card, not schmear the king.
      const play = bot.choosePlay(activeState as GameState, hand);
      expect(play).toEqual({ kind: "suit", suit: "hearts", rank: "two" });
    });
  });
});
