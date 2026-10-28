import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  dispatchBid,
  dispatchTalonPick,
  dispatchDiscard,
  dispatchRaiseToBarvniValat,
  PASS,
  isTarokCard,
  isSuitCard,
  type Card,
} from "../../src/index.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import { shuffle } from "../../src/shuffle/shuffle.js";
import { createSeededRng } from "../../src/rng/rng.js";
import { deal } from "../../src/deal/deal.js";

function dealSoloTriState(seed = 42) {
  const deck = shuffle(createTarokDeck(), createSeededRng(seed));
  const dealt = deal(deck, { playerCount: 4 });
  let state = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    initialHands: {
      0: [...dealt.hands[0]!],
      1: [...dealt.hands[1]!],
      2: [...dealt.hands[2]!],
      3: [...dealt.hands[3]!],
    },
    initialTalon: dealt.talon,
  });
  // P0 solo_tri, others pass
  state = dispatchBid(state, 0, "solo_tri");
  state = dispatchBid(state, 1, PASS);
  state = dispatchBid(state, 2, PASS);
  state = dispatchBid(state, 3, PASS);
  expect(state.phase).toBe("talon");
  expect(state.contract).toBe("solo_tri");
  return state;
}

function legalDiscards(hand: readonly Card[], count: number): Card[] {
  const discardable = hand.filter((c) => {
    if (isTarokCard(c)) {
      return c.rank !== "skis" && c.rank !== 1 && !(c.rank === 21 && c.name === "mond");
    }
    if (isSuitCard(c) && c.rank === "king") return false;
    return true;
  });
  const suits = discardable.filter(isSuitCard);
  const taroks = discardable.filter(isTarokCard);
  return [...suits, ...taroks].slice(0, count);
}

describe("Post-talon raise to barvni valat", () => {
  it("enters raising phase after solo_tri discard", () => {
    let state = dealSoloTriState();
    state = dispatchTalonPick(state, 0, 0);
    const hand = state.hands[0]!;
    const discards = legalDiscards(hand, 3);
    expect(discards.length).toBe(3);
    state = dispatchDiscard(state, 0, discards);
    expect(state.phase).toBe("raising");
    expect(state.contract).toBe("solo_tri");
  });

  it("raise=true sets barvni_valat and starts play with declarer lead", () => {
    let state = dealSoloTriState(99);
    state = dispatchTalonPick(state, 0, 0);
    state = dispatchDiscard(state, 0, legalDiscards(state.hands[0]!, 3));
    state = dispatchRaiseToBarvniValat(state, 0, true);
    expect(state.contract).toBe("barvni_valat");
    expect(state.phase).toBe("playing");
    expect(state.trickRound?.currentTrick.leader).toBe(0);
    expect(state.currentPlayer).toBe(0);
    expect(state.announcementsRound).toBeUndefined();
  });

  it("raise=false continues to announcements with original solo contract", () => {
    let state = dealSoloTriState(7);
    state = dispatchTalonPick(state, 0, 0);
    state = dispatchDiscard(state, 0, legalDiscards(state.hands[0]!, 3));
    state = dispatchRaiseToBarvniValat(state, 0, false);
    expect(state.contract).toBe("solo_tri");
    expect(state.phase).toBe("announcements");
    expect(state.announcementsRound).toBeDefined();
  });
});
