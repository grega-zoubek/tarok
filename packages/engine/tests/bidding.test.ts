import { describe, it, expect } from "vitest";
import {
  BIDS,
  PASS,
  createBiddingRound,
  getCurrentBiddingPlayer,
  isLegalBid,
  placeBid,
  resolveBidding,
  getBidPriority,
} from "../src/bidding/bidding.js";

describe("Bidding", () => {
  const playerOrder = [0, 1, 2, 3];
  
  describe("getBidPriority", () => {
    it("orders bids correctly", () => {
      expect(getBidPriority("tri")).toBeLessThan(getBidPriority("dve"));
      expect(getBidPriority("ena")).toBeLessThan(getBidPriority("solo_tri"));
      expect(getBidPriority("berac")).toBeLessThan(getBidPriority("valat"));
    });
  });

  describe("createBiddingRound", () => {
    it("initializes a valid round", () => {
      const round = createBiddingRound({ playerOrder, forehand: 0 });
      expect(round.playerOrder).toEqual(playerOrder);
      expect(round.forehand).toBe(0);
      expect(round.isFinished).toBe(false);
      expect(getCurrentBiddingPlayer(round)).toBe(0);
    });

    it("throws if not exactly 4 players", () => {
      expect(() => createBiddingRound({ playerOrder: [0, 1, 2], forehand: 0 })).toThrowError();
    });

    it("throws if forehand is not in players", () => {
      expect(() => createBiddingRound({ playerOrder, forehand: 99 })).toThrowError();
    });
  });

  describe("Bidding flow & legality", () => {
    it("allows any bid initially", () => {
      const round = createBiddingRound({ playerOrder, forehand: 0 });
      expect(isLegalBid(round, 0, "tri")).toBe(true);
      expect(isLegalBid(round, 0, "valat")).toBe(true);
    });

    it("handles Klop (everyone passes)", () => {
      let round = createBiddingRound({ playerOrder, forehand: 0 });
      
      round = placeBid(round, 0, PASS);
      round = placeBid(round, 1, PASS);
      round = placeBid(round, 2, PASS);
      round = placeBid(round, 3, PASS);

      expect(round.isFinished).toBe(true);
      
      const result = resolveBidding(round);
      expect(result.contract).toBe("klop");
      expect(result.declarer).toBeUndefined();
    });

    it("requires non-forehand players to outbid", () => {
      let round = createBiddingRound({ playerOrder, forehand: 0 });
      
      // Forehand bids "tri"
      round = placeBid(round, 0, "tri");
      
      // Player 1 cannot bid "tri", must bid "dve" or higher
      expect(isLegalBid(round, 1, "tri")).toBe(false);
      expect(isLegalBid(round, 1, "dve")).toBe(true);
      
      round = placeBid(round, 1, "dve");
      expect(round.currentHighestBid).toEqual({ playerId: 1, bid: "dve" });
    });

    it("allows forehand to hold (izenačiti) a bid", () => {
      let round = createBiddingRound({ playerOrder, forehand: 0 });
      
      // Forehand passes initially? Wait, standard rules say forehand bids first.
      // If forehand bids "tri", P1 bids "dve", P2 passes, P3 passes.
      // Forehand can then hold "dve".
      round = placeBid(round, 0, "tri");
      round = placeBid(round, 1, "dve");
      round = placeBid(round, 2, PASS);
      round = placeBid(round, 3, PASS);
      
      // It should be forehand's turn again
      expect(getCurrentBiddingPlayer(round)).toBe(0);
      
      // Forehand can bid "dve" to hold
      expect(isLegalBid(round, 0, "dve")).toBe(true);
      
      round = placeBid(round, 0, "dve");
      expect(round.currentHighestBid).toEqual({ playerId: 0, bid: "dve" });
    });

    it("finishes when 3 players pass after a bid", () => {
      let round = createBiddingRound({ playerOrder, forehand: 0 });
      
      round = placeBid(round, 0, PASS); // Forehand passes
      round = placeBid(round, 1, "tri"); // P1 bids 3
      round = placeBid(round, 2, PASS); // P2 passes
      round = placeBid(round, 3, PASS); // P3 passes

      // Since Forehand already passed, and P2, P3 passed, P1 is the only one left.
      expect(round.isFinished).toBe(true);

      const result = resolveBidding(round);
      expect(result.contract).toBe("tri");
      expect(result.declarer).toBe(1);
    });

    it("skips players who have already passed", () => {
      let round = createBiddingRound({ playerOrder, forehand: 0 });
      
      round = placeBid(round, 0, "tri");
      round = placeBid(round, 1, PASS);
      round = placeBid(round, 2, "dve");
      round = placeBid(round, 3, PASS);
      
      // Back to forehand (0)
      expect(getCurrentBiddingPlayer(round)).toBe(0);
      round = placeBid(round, 0, "dve"); // holds
      
      // Next player should be 2, because 1 passed.
      expect(getCurrentBiddingPlayer(round)).toBe(2);
      round = placeBid(round, 2, PASS); // 2 gives up
      
      expect(round.isFinished).toBe(true);
      const result = resolveBidding(round);
      expect(result.declarer).toBe(0);
      expect(result.contract).toBe("dve");
    });
  });
});
