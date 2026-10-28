import { describe, it, expect } from "vitest";
import {
  createBiddingRound,
  isLegalBid,
  placeBid,
  resolveBidding,
  PASS,
  createInitialGameState,
  dispatchBid,
} from "../../src/index.js";

describe("Compulsory klop bidding", () => {
  it("blocks tri–berač during compulsory klop", () => {
    const round = createBiddingRound({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      compulsoryKlop: true,
    });
    expect(isLegalBid(round, 0, "tri", true)).toBe(false);
    expect(isLegalBid(round, 0, "berac", true)).toBe(false);
    expect(isLegalBid(round, 0, "solo_brez", true)).toBe(true);
    expect(isLegalBid(round, 0, "valat", true)).toBe(true);
  });

  it("allows normal bids when not compulsory", () => {
    const round = createBiddingRound({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      compulsoryKlop: false,
    });
    expect(isLegalBid(round, 0, "tri", false)).toBe(true);
  });

  it("all pass still resolves to klop under compulsory mode", () => {
    let round = createBiddingRound({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      compulsoryKlop: true,
    });
    round = placeBid(round, 0, PASS);
    round = placeBid(round, 1, PASS);
    round = placeBid(round, 2, PASS);
    round = placeBid(round, 3, PASS);
    expect(resolveBidding(round).contract).toBe("klop");
  });

  it("dispatchBid rejects illegal low bids when game is compulsory klop", () => {
    const state = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: { 0: [], 1: [], 2: [], 3: [] },
      initialTalon: [],
      compulsoryKlop: true,
    });
    expect(() => dispatchBid(state, 0, "tri")).toThrow(/Neveljavna licitacija/);
    const next = dispatchBid(state, 0, "solo_brez");
    expect(next.contract).toBe("solo_brez");
  });
});
