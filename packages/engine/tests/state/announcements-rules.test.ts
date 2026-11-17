import { describe, expect, it } from "vitest";

import { createTarokDeck } from "../../src/cards/deck.js";
import { cardsEqual, type Card } from "../../src/cards/card.js";
import {
  createAnnouncementsRound,
  getCurrentAnnouncingPlayer,
} from "../../src/announcements/announcements.js";
import {
  createInitialGameState,
  dispatchAnnouncement,
  dispatchAnnouncementPass,
  getAnnouncementError,
  type GameState,
} from "../../src/state/state.js";

function createAnnouncementsState(): GameState {
  const deck = createTarokDeck();
  const base = createInitialGameState({
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

  return {
    ...base,
    phase: "announcements",
    contract: "tri",
    declarer: 0,
    teams: { declarerTeam: [0, 1], defendingTeam: [2, 3] },
    calledKing: { suit: "spades", rank: "king" },
    announcementsRound: createAnnouncementsRound([0, 1, 2, 3], 0, 0),
    currentPlayer: 0,
  };
}

/** Premakne izbrane karte v roko ciljnega igralca (in izmenja karte, ki so tam). */
function moveCardsToHand(state: GameState, targetPid: number, cards: readonly Card[]): GameState {
  const hands: Record<number, Card[]> = {};
  for (const pid of state.playerOrder) {
    hands[pid] = [...state.hands[pid]!];
  }

  for (const card of cards) {
    let sourcePid: number | undefined;
    let sourceIndex = -1;
    for (const pid of state.playerOrder) {
      const index = hands[pid]!.findIndex((held) => cardsEqual(held, card));
      if (index >= 0) {
        sourcePid = pid;
        sourceIndex = index;
        break;
      }
    }
    if (sourcePid === undefined) {
      throw new Error("Karta ni v nobeni roki");
    }
    if (sourcePid === targetPid) {
      continue;
    }

    const targetHand = hands[targetPid]!;
    const targetIndex = targetHand.findIndex(
      (held) => !cards.some((selected) => cardsEqual(selected, held)),
    );
    if (targetIndex < 0) {
      throw new Error("Ciljna roka je polna");
    }

    const displaced = targetHand[targetIndex]!;
    targetHand[targetIndex] = card;
    hands[sourcePid]![sourceIndex] = displaced;
  }

  return { ...state, hands };
}

const pagat = createTarokDeck().find((card) => card.kind === "tarok" && card.rank === 1)!;
const spadesKing = createTarokDeck().find(
  (card) => card.kind === "suit" && card.suit === "spades" && card.rank === "king",
)!;

describe("pravila napovedi", () => {
  it("napovedi se začnejo pri deklarantu, ne pri forehandu", () => {
    const round = createAnnouncementsRound([0, 1, 2, 3], 2);
    expect(getCurrentAnnouncingPlayer(round)).toBe(2);
  });

  it("igralec, ki ni na potezi, ne sme napovedati", () => {
    const state = createAnnouncementsState();

    expect(() => dispatchAnnouncement(state, 1, "kralji")).toThrow("not player 1's turn");
  });

  it("prepreči dvojno napoved iste vrste", () => {
    const state = createAnnouncementsState();
    const announced = dispatchAnnouncement(state, 0, "kralji");

    expect(() => dispatchAnnouncement(announced, 0, "kralji")).toThrow("already announced kralji");
  });

  it("po passu igralec ne more več napovedati", () => {
    const state = createAnnouncementsState();
    const passed = dispatchAnnouncementPass(state, 0);

    expect(passed.currentPlayer).toBe(1);
    expect(() => dispatchAnnouncement(passed, 0, "kralji")).toThrow("not player 0's turn");
  });

  it("valat lahko napove samo aktivna ekipa", () => {
    const state = createAnnouncementsState();
    const afterDeclarer = dispatchAnnouncementPass(state, 0);
    const afterPartner = dispatchAnnouncementPass(afterDeclarer, 1);

    expect(afterPartner.currentPlayer).toBe(2);
    expect(getAnnouncementError(afterPartner, 2, "valat")).toMatch(/aktivna ekipa/);
    expect(() => dispatchAnnouncement(afterPartner, 2, "valat")).toThrow();
  });

  it("kralj_ultimo lahko napove samo imetnik klicanega kralja", () => {
    const state = moveCardsToHand(createAnnouncementsState(), 1, [spadesKing]);

    expect(getAnnouncementError(state, 0, "kralj_ultimo")).toMatch(/ima klicanega kralja/);

    const afterDeclarer = dispatchAnnouncementPass(state, 0);
    expect(afterDeclarer.currentPlayer).toBe(1);
    expect(getAnnouncementError(afterDeclarer, 1, "kralj_ultimo")).toBeUndefined();

    const announced = dispatchAnnouncement(afterDeclarer, 1, "kralj_ultimo");
    expect(
      announced.announcementsRound?.announcements[1]?.some((a) => a.type === "kralj_ultimo"),
    ).toBe(true);
  });

  it("pagat_ultimo lahko napove samo imetnik pagata", () => {
    const state = moveCardsToHand(createAnnouncementsState(), 2, [pagat]);

    expect(getAnnouncementError(state, 0, "pagat_ultimo")).toMatch(/ima pagata/);

    const afterDeclarer = dispatchAnnouncementPass(state, 0);
    const afterPartner = dispatchAnnouncementPass(afterDeclarer, 1);

    expect(getAnnouncementError(afterPartner, 2, "pagat_ultimo")).toBeUndefined();
  });
});
