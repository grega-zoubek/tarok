import { describe, expect, it } from "vitest";

import { createTarokDeck } from "../../src/cards/deck.js";
import { cardsEqual, isSuitCard, type Card } from "../../src/cards/card.js";
import { PASS } from "../../src/bidding/bidding.js";
import {
  createInitialGameState,
  dispatchBid,
  dispatchCall,
  dispatchDiscard,
  dispatchTalonPick,
  getRequiredTalonGroup,
  type GameState,
} from "../../src/state/state.js";
import { getDiscardPool } from "../../src/talon/talon.js";

function setupCallingWithKingInTalon(): GameState {
  const deck = createTarokDeck();
  const spadesKing = deck.find(
    (card): card is Card =>
      isSuitCard(card) && card.suit === "spades" && card.rank === "king",
  )!;
  const rest = deck.filter((card) => !cardsEqual(card, spadesKing));

  // Kralj pade v prvi kupček (indeks 0), deklarant pa ga nima v roki.
  const talon = [rest[0]!, spadesKing, rest[1]!, rest[2]!, rest[3]!, rest[4]!];
  const handCards = rest.slice(5, 5 + 48);

  let state = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    initialHands: {
      0: handCards.slice(0, 12),
      1: handCards.slice(12, 24),
      2: handCards.slice(24, 36),
      3: handCards.slice(36, 48),
    },
    initialTalon: talon,
  });

  state = dispatchBid(state, 0, "tri");
  state = dispatchBid(state, 1, PASS);
  state = dispatchBid(state, 2, PASS);
  state = dispatchBid(state, 3, PASS);

  return dispatchCall(state, 0, "spades");
}

describe("klicani kralj v talonu", () => {
  it("deklarant mora vzeti skupino s klicanim kraljem", () => {
    const state = setupCallingWithKingInTalon();

    expect(state.phase).toBe("talon");
    expect(state.calledKingInTalon).toBe(true);
    expect(getRequiredTalonGroup(state)).toBe(0);

    expect(() => dispatchTalonPick(state, 0, 1)).toThrow(
      "Klicani kralj je v talonu",
    );

    const picked = dispatchTalonPick(state, 0, 0);
    expect(picked.pickedTalonGroupIndex).toBe(0);
    expect(
      picked.hands[0]!.some(
        (card) => isSuitCard(card) && card.suit === "spades" && card.rank === "king",
      ),
    ).toBe(true);
  });

  it("deklarant igra sam, tudi ko kralja pobere iz talona", () => {
    const state = setupCallingWithKingInTalon();

    expect(state.teams).toEqual({
      declarerTeam: [0],
      defendingTeam: [1, 2, 3],
    });

    const picked = dispatchTalonPick(state, 0, 0);
    const discard = getDiscardPool(picked.hands[0]!, 3);
    expect(discard.length).toBeGreaterThanOrEqual(3);
    const finished = dispatchDiscard(picked, 0, discard.slice(0, 3));

    expect(finished.phase).toBe("announcements");
    expect(finished.teams).toEqual({
      declarerTeam: [0],
      defendingTeam: [1, 2, 3],
    });
  });

  it("ne dovoli klicati kralja, ki ga deklarant že ima", () => {
    const deck = createTarokDeck();
    const heartsKing = deck.find(
      (card) => isSuitCard(card) && card.suit === "hearts" && card.rank === "king",
    )!;
    const others = deck.filter((card) => !cardsEqual(card, heartsKing));
    // Deklarant (0) ima srčnega kralja.
    let state = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: {
        0: [...others.slice(0, 11), heartsKing],
        1: others.slice(11, 23),
        2: others.slice(23, 35),
        3: others.slice(35, 47),
      },
      initialTalon: others.slice(47, 53),
    });
    expect(
      state.hands[0]!.some(
        (card) => isSuitCard(card) && card.suit === "hearts" && card.rank === "king",
      ),
    ).toBe(true);

    state = dispatchBid(state, 0, "tri");
    state = dispatchBid(state, 1, PASS);
    state = dispatchBid(state, 2, PASS);
    state = dispatchBid(state, 3, PASS);

    expect(() => dispatchCall(state, 0, "hearts")).toThrow(
      "cannot call a king they already hold",
    );
  });
});
