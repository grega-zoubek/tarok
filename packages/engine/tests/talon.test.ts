import { describe, it, expect } from "vitest";
import {
  createTalonExchange,
  pickTalonGroup,
  isLegalDiscard,
  discardCards,
} from "../src/talon/talon.js";
import type { Card } from "../src/cards/card.js";

describe("Talon Exchange", () => {
  const mockTalon: Card[] = [
    { kind: "suit", suit: "hearts", rank: "king" },
    { kind: "suit", suit: "spades", rank: "queen" },
    { kind: "tarok", rank: 2, name: "ii" },
    { kind: "tarok", rank: 3, name: "iii" },
    { kind: "suit", suit: "clubs", rank: "jack" },
    { kind: "suit", suit: "diamonds", rank: "ace" },
  ];

  describe("Initialization", () => {
    it("groups talon correctly for exchange 3", () => {
      const round = createTalonExchange(0, mockTalon, 3);
      expect(round.talonGroups.length).toBe(2);
      expect(round.talonGroups[0]?.length).toBe(3);
      expect(round.talonGroups[1]?.length).toBe(3);
    });

    it("groups talon correctly for exchange 2", () => {
      const round = createTalonExchange(0, mockTalon, 2);
      expect(round.talonGroups.length).toBe(3);
      expect(round.talonGroups[0]?.length).toBe(2);
    });

    it("groups talon correctly for exchange 1", () => {
      const round = createTalonExchange(0, mockTalon, 1);
      expect(round.talonGroups.length).toBe(6);
      expect(round.talonGroups[0]?.length).toBe(1);
    });
  });

  describe("Picking and discarding", () => {
    it("allows declarer to pick a group", () => {
      let round = createTalonExchange(1, mockTalon, 3);
      round = pickTalonGroup(round, 1, 1);
      expect(round.pickedGroupIndex).toBe(1);
    });

    it("throws if non-declarer tries to pick", () => {
      const round = createTalonExchange(1, mockTalon, 3);
      expect(() => pickTalonGroup(round, 0, 1)).toThrowError();
    });

    it("evaluates legal discards correctly", () => {
      const hand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "queen" },
        { kind: "suit", suit: "spades", rank: "cavalier" },
        { kind: "tarok", rank: 10, name: "x" },
        { kind: "suit", suit: "hearts", rank: "king" },
      ];

      // Legal: discarding two normal suit cards
      expect(
        isLegalDiscard(
          [
            { kind: "suit", suit: "hearts", rank: "queen" },
            { kind: "suit", suit: "spades", rank: "cavalier" },
          ],
          hand
        )
      ).toBe(true);

      // Illegal: discarding a 5-point card (King)
      expect(
        isLegalDiscard(
          [
            { kind: "suit", suit: "hearts", rank: "queen" },
            { kind: "suit", suit: "hearts", rank: "king" },
          ],
          hand
        )
      ).toBe(false);

      // Illegal: discarding a tarok while holding suit cards
      expect(
        isLegalDiscard(
          [
            { kind: "suit", suit: "hearts", rank: "queen" },
            { kind: "tarok", rank: 10, name: "x" },
          ],
          hand
        )
      ).toBe(false);
    });

    it("allows discarding a tarok if forced", () => {
      const forcedHand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "queen" }, // only 1 normal suit card
        { kind: "suit", suit: "hearts", rank: "king" },
        { kind: "tarok", rank: 10, name: "x" },
        { kind: "tarok", rank: 11, name: "xi" },
      ];

      // To discard 2 cards, they MUST discard the queen and a tarok
      expect(
        isLegalDiscard(
          [
            { kind: "suit", suit: "hearts", rank: "queen" },
            { kind: "tarok", rank: 10, name: "x" },
          ],
          forcedHand
        )
      ).toBe(true);
    });

    it("completes the round upon valid discard", () => {
      let round = createTalonExchange(1, mockTalon, 2);
      round = pickTalonGroup(round, 1, 0);

      const hand: Card[] = [
        { kind: "suit", suit: "hearts", rank: "queen" },
        { kind: "suit", suit: "spades", rank: "cavalier" },
      ];

      round = discardCards(round, 1, hand, hand); // Discarding the exact hand just for test
      expect(round.isFinished).toBe(true);
      expect(round.discardedCards.length).toBe(2);
    });
  });
});
