import { describe, it, expect } from "vitest";
import {
  createCallingRound,
  callKing,
  skipCalling,
  determineTeams,
} from "../src/calling/calling.js";
import type { SuitCard } from "../src/cards/card.js";

describe("Calling a King", () => {
  describe("Calling mechanism", () => {
    it("initializes calling round correctly", () => {
      const round = createCallingRound(1);
      expect(round.declarer).toBe(1);
      expect(round.calledKing).toBeUndefined();
      expect(round.isFinished).toBe(false);
    });

    it("allows the declarer to call a King", () => {
      let round = createCallingRound(1);
      round = callKing(round, 1, "spades");

      expect(round.isFinished).toBe(true);
      expect(round.calledKing).toEqual({ suit: "spades", rank: "king" });
    });

    it("throws if a non-declarer tries to call", () => {
      const round = createCallingRound(1);
      expect(() => callKing(round, 2, "hearts")).toThrowError();
    });

    it("allows skipping the call (e.g. for Solo)", () => {
      let round = createCallingRound(2);
      round = skipCalling(round, 2);

      expect(round.isFinished).toBe(true);
      expect(round.calledKing).toBeUndefined();
    });
  });

  describe("Determining teams", () => {
    const p0Hand: SuitCard[] = [
      { kind: "suit", suit: "hearts", rank: "king" },
    ];
    const p1Hand: SuitCard[] = [
      { kind: "suit", suit: "spades", rank: "king" },
    ];
    const p2Hand: SuitCard[] = [
      { kind: "suit", suit: "diamonds", rank: "king" },
    ];
    const p3Hand: SuitCard[] = [
      { kind: "suit", suit: "clubs", rank: "king" },
    ];

    const hands = {
      0: p0Hand,
      1: p1Hand,
      2: p2Hand,
      3: p3Hand,
    };

    it("puts declarer and partner in one team, others in defending", () => {
      // Declarer is 0, calls Spades (held by 1)
      const teams = determineTeams(hands, 0, { suit: "spades", rank: "king" });
      
      expect(teams.declarerTeam).toEqual([0, 1]);
      expect(teams.defendingTeam).toEqual([2, 3]);
    });

    it("makes declarer play alone if they skip calling", () => {
      const teams = determineTeams(hands, 2, undefined);
      
      expect(teams.declarerTeam).toEqual([2]);
      expect(teams.defendingTeam).toEqual([0, 1, 3]);
    });

    it("makes declarer play alone if they call their own king", () => {
      // Declarer is 3, calls Clubs (held by themselves)
      const teams = determineTeams(hands, 3, { suit: "clubs", rank: "king" });

      expect(teams.declarerTeam).toEqual([3]);
      expect(teams.defendingTeam).toEqual([0, 1, 2]);
    });

    it("makes declarer play alone if the called king is not in any player hand (i.e., in talon)", () => {
      // Declarer 1 calls Hearts, but we modify the hands so Hearts King is missing
      const modifiedHands = {
        0: [], // Missing Hearts King
        1: p1Hand,
        2: p2Hand,
        3: p3Hand,
      };

      const teams = determineTeams(modifiedHands, 1, { suit: "hearts", rank: "king" });
      expect(teams.declarerTeam).toEqual([1]);
      expect(teams.defendingTeam).toEqual([0, 2, 3]);
    });
  });
});
