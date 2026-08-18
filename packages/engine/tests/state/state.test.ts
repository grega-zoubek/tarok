import { describe, it, expect } from "vitest";
import { createInitialGameState, dispatchBid, dispatchCall, dispatchTalonPick, dispatchDiscard, dispatchPlay } from "../../src/state/state.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import { PASS } from "../../src/bidding/bidding.js";

// A mock setup to create an initial game state
function setupMockGame() {
  const deck = createTarokDeck();
  // Simply slice the deck for mock hands (not a valid deal, but enough to test state transitions)
  return createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    initialHands: {
      0: deck.slice(0, 12),
      1: deck.slice(12, 24),
      2: deck.slice(24, 36),
      3: deck.slice(36, 48),
    },
    initialTalon: deck.slice(48, 54),
  });
}

describe("Game State Transitions", () => {
  it("initializes to bidding phase", () => {
    const state = setupMockGame();
    expect(state.phase).toBe("bidding");
    expect(state.currentPlayer).toBe(0); // forehand
  });

  it("handles a Klop game (everyone passes)", () => {
    let state = setupMockGame();
    state = dispatchBid(state, 0, PASS);
    state = dispatchBid(state, 1, PASS);
    state = dispatchBid(state, 2, PASS);
    state = dispatchBid(state, 3, PASS);

    expect(state.phase).toBe("playing"); // Klop skips calling & talon
    expect(state.contract).toBe("klop");
    expect(state.trickRound).toBeDefined();
    expect(state.trickRound?.currentTrick.leader).toBe(0); // forehand starts playing in klop
  });

  it("transitions to calling phase after a 3/2/1 contract is won", () => {
    let state = setupMockGame();
    
    state = dispatchBid(state, 0, "tri");
    state = dispatchBid(state, 1, PASS);
    state = dispatchBid(state, 2, PASS);
    state = dispatchBid(state, 3, PASS);

    expect(state.phase).toBe("calling");
    expect(state.declarer).toBe(0);
    expect(state.contract).toBe("tri");
    expect(state.currentPlayer).toBe(0); // declarer must now call
  });

  it("skips calling phase for solo games and goes directly to talon", () => {
    let state = setupMockGame();
    
    state = dispatchBid(state, 0, "solo_tri");
    state = dispatchBid(state, 1, PASS);
    state = dispatchBid(state, 2, PASS);
    state = dispatchBid(state, 3, PASS);

    expect(state.phase).toBe("talon");
    expect(state.declarer).toBe(0);
    expect(state.contract).toBe("solo_tri");
    expect(state.currentPlayer).toBe(0); // declarer must pick talon
  });

  it("handles calling a king and transitions to talon", () => {
    let state = setupMockGame();
    
    // Win bid
    state = dispatchBid(state, 0, "tri");
    state = dispatchBid(state, 1, PASS);
    state = dispatchBid(state, 2, PASS);
    state = dispatchBid(state, 3, PASS);

    // Call King
    state = dispatchCall(state, 0, "spades");

    expect(state.phase).toBe("talon");
    expect(state.calledKing).toEqual({ suit: "spades", rank: "king" });
    expect(state.teams).toBeDefined(); // Teams should be resolved
    expect(state.currentPlayer).toBe(0);
  });
});
