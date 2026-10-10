import { describe, it, expect } from "vitest";
import { getCardValue, countPoints, hasTrula, hasAllKings } from "../src/scoring/scoring.js";
import { createTarokDeck } from "../src/cards/deck.js";
import { type Card } from "../src/cards/card.js";

// Zaokroževanje razlike: cifra 8,9,0,1,2 → na 0; cifra 3,4,5,6,7 → na 5
function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

describe("Zaokroževanje razlike (roundToNearest5)", () => {
  const cases: [number, number][] = [
    [49, 50], // cifra 9 → na 0
    [48, 50], // cifra 8 → na 0
    [47, 45], // cifra 7 → na 5
    [46, 45], // cifra 6 → na 5
    [45, 45], // cifra 5 → na 5
    [44, 45], // cifra 4 → na 5
    [43, 45], // cifra 3 → na 5
    [42, 40], // cifra 2 → na 0
    [41, 40], // cifra 1 → na 0
    [40, 40], // cifra 0 → na 0
    [59, 60], // cifra 9 → na 0
    [57, 55], // cifra 7 → na 5
    [35, 35], // točno 35 → 35
    [36, 35], // cifra 6 → na 5 (ni 0) ... wait: 36 → 35 ker je 36 bliže 35
    [38, 40], // cifra 8 → na 0
  ];
  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(roundToNearest5(input)).toBe(expected);
    });
  }
});

describe("Scoring", () => {
  describe("getCardValue", () => {
    it("assigns 5 points to Trula cards", () => {
      expect(getCardValue({ kind: "tarok", rank: "skis", name: "skis" })).toBe(5);
      expect(getCardValue({ kind: "tarok", rank: 21, name: "mond" })).toBe(5);
      expect(getCardValue({ kind: "tarok", rank: 1, name: "pagat" })).toBe(5);
    });

    it("assigns 1 point to empty Taroks", () => {
      expect(getCardValue({ kind: "tarok", rank: 2, name: "ii" })).toBe(1);
      expect(getCardValue({ kind: "tarok", rank: 10, name: "x" })).toBe(1);
      expect(getCardValue({ kind: "tarok", rank: 20, name: "xx" })).toBe(1);
    });

    it("assigns correct points to suit face cards", () => {
      expect(getCardValue({ kind: "suit", suit: "hearts", rank: "king" })).toBe(5);
      expect(getCardValue({ kind: "suit", suit: "spades", rank: "queen" })).toBe(4);
      expect(getCardValue({ kind: "suit", suit: "diamonds", rank: "cavalier" })).toBe(3);
      expect(getCardValue({ kind: "suit", suit: "clubs", rank: "jack" })).toBe(2);
    });

    it("assigns 1 point to suit pip cards", () => {
      expect(getCardValue({ kind: "suit", suit: "hearts", rank: "ace" })).toBe(1);
      expect(getCardValue({ kind: "suit", suit: "hearts", rank: "two" })).toBe(1);
      expect(getCardValue({ kind: "suit", suit: "spades", rank: "seven" })).toBe(1);
      expect(getCardValue({ kind: "suit", suit: "clubs", rank: "ten" })).toBe(1);
    });
  });

  describe("countPoints", () => {
    it("calculates exact 70 points for the full deck", () => {
      const deck = createTarokDeck();
      expect(countPoints(deck)).toBe(70);
    });

    it("calculates correctly for 3 cards (sum - 2)", () => {
      const cards: Card[] = [
        { kind: "tarok", rank: "skis", name: "skis" }, // 5
        { kind: "suit", suit: "hearts", rank: "king" }, // 5
        { kind: "tarok", rank: 2, name: "ii" } // 1
      ];
      // Raw: 11, Deduct 2 -> 9
      expect(countPoints(cards)).toBe(9);
    });

    it("calculates correctly for 2 cards (sum - 1)", () => {
      const cards: Card[] = [
        { kind: "tarok", rank: "skis", name: "skis" }, // 5
        { kind: "suit", suit: "hearts", rank: "king" } // 5
      ];
      // Raw: 10, Deduct 1 -> 9
      expect(countPoints(cards)).toBe(9);
    });

    it("calculates correctly for 1 card (sum - 1)", () => {
      const cards: Card[] = [
        { kind: "tarok", rank: "skis", name: "skis" } // 5
      ];
      // Raw: 5, Deduct 1 -> 4
      expect(countPoints(cards)).toBe(4);
    });

    it("calculates correctly for 4 cards (sum - 3: 2 for group of 3, 1 for remainder 1)", () => {
      const cards: Card[] = [
        { kind: "suit", suit: "hearts", rank: "king" }, // 5
        { kind: "suit", suit: "hearts", rank: "queen" }, // 4
        { kind: "suit", suit: "hearts", rank: "cavalier" }, // 3
        { kind: "suit", suit: "hearts", rank: "jack" }, // 2
      ];
      // Raw: 14, Deduct 3 -> 11
      expect(countPoints(cards)).toBe(11);
    });

    it("calculates correctly for 5 cards (sum - 3: 2 for group of 3, 1 for remainder 2)", () => {
        const cards: Card[] = [
          { kind: "suit", suit: "hearts", rank: "king" }, // 5
          { kind: "suit", suit: "hearts", rank: "queen" }, // 4
          { kind: "suit", suit: "hearts", rank: "cavalier" }, // 3
          { kind: "suit", suit: "hearts", rank: "jack" }, // 2
          { kind: "suit", suit: "hearts", rank: "two" }, // 1
        ];
        // Raw: 15, Deduct 3 -> 12
        expect(countPoints(cards)).toBe(12);
      });
  });

  describe("Bonuses", () => {
    describe("hasTrula", () => {
      it("returns true when all Trula cards are present", () => {
        const cards: Card[] = [
          { kind: "tarok", rank: "skis", name: "skis" },
          { kind: "tarok", rank: 21, name: "mond" },
          { kind: "tarok", rank: 1, name: "pagat" },
          { kind: "suit", suit: "hearts", rank: "king" }
        ];
        expect(hasTrula(cards)).toBe(true);
      });

      it("returns false when one Trula card is missing", () => {
        const cards: Card[] = [
          { kind: "tarok", rank: "skis", name: "skis" },
          { kind: "tarok", rank: 1, name: "pagat" },
          { kind: "suit", suit: "hearts", rank: "king" }
        ];
        expect(hasTrula(cards)).toBe(false);
      });
    });

    describe("hasAllKings", () => {
      it("returns true when all 4 Kings are present", () => {
        const cards: Card[] = [
          { kind: "suit", suit: "hearts", rank: "king" },
          { kind: "suit", suit: "diamonds", rank: "king" },
          { kind: "suit", suit: "spades", rank: "king" },
          { kind: "suit", suit: "clubs", rank: "king" },
          { kind: "tarok", rank: "skis", name: "skis" }
        ];
        expect(hasAllKings(cards)).toBe(true);
      });

      it("returns false when a King is missing", () => {
        const cards: Card[] = [
          { kind: "suit", suit: "hearts", rank: "king" },
          { kind: "suit", suit: "diamonds", rank: "king" },
          { kind: "suit", suit: "spades", rank: "king" },
          { kind: "tarok", rank: "skis", name: "skis" }
        ];
        expect(hasAllKings(cards)).toBe(false);
      });
    });
  });
});
