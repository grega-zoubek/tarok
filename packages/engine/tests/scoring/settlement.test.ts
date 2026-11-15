import { describe, it, expect } from "vitest";
import { calculateGameScore } from "../../src/scoring/game-scoring.js";
import { settleGame } from "../../src/scoring/settlement.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import { isSuitCard, isTarokCard, type Card } from "../../src/cards/card.js";
import type { GameState } from "../../src/state/state.js";
import type { TrickRound } from "../../src/game/trick-round.js";
import type { Bid } from "../../src/bidding/bidding.js";
import type { Teams } from "../../src/calling/calling.js";

const deck = createTarokDeck();

function pickHighCards(): Card[] {
  const trula = deck.filter(
    (c) => isTarokCard(c) && (c.rank === 1 || c.rank === 21 || c.rank === "skis"),
  );
  const kings = deck.filter((c) => isSuitCard(c) && c.rank === "king");
  const queens = deck.filter((c) => isSuitCard(c) && c.rank === "queen");
  const pip = deck.find((c) => isSuitCard(c) && c.rank === "ace");
  return [...trula, ...kings, ...queens, pip!];
}

function pickLowCards(used: readonly Card[] = []): Card[] {
  const usedKeys = new Set(used.map((c) => `${c.kind}:${String(c.rank)}:${c.kind === "suit" ? c.suit : c.name}`));
  return deck
    .filter((c) => isSuitCard(c) && !["king", "queen", "cavalier", "jack"].includes(c.rank))
    .filter((c) => !usedKeys.has(`${c.kind}:${String(c.rank)}:${c.kind === "suit" ? c.suit : c.name}`))
    .slice(0, 16);
}

function makeTrick(cards: Card[], winner: number, leader = 0) {
  return {
    winner,
    trick: {
      leader,
      // Vsi prispevki so pripisani zmagovalcu, da mock stanje ne sproži
      // lažnega mondfanga (v pravem štihu bi karte pripadale različnim igralcem).
      plays: cards.map((card) => ({ playerId: winner, card })),
    },
  };
}

interface BuildOptions {
  contract: Bid | "klop";
  teams: Teams;
  declarer: number;
  declarerTricks: number;
  defenderTricks: number;
  talon?: readonly Card[];
  discardedCards?: readonly Card[];
}

/** Zgradi končano igro s 3–4 štihi; visoke karte so v štihih aktivne ekipe. */
function buildFinishedState(options: BuildOptions): GameState {
  const high = pickHighCards();
  const low = pickLowCards(high);

  const capturedTricks = [];
  let highIndex = 0;
  let lowIndex = 0;

  for (let i = 0; i < options.declarerTricks; i++) {
    capturedTricks.push(makeTrick(high.slice(highIndex, highIndex + 4), options.teams.declarerTeam[0]!, 0));
    highIndex += 4;
  }
  for (let i = 0; i < options.defenderTricks; i++) {
    capturedTricks.push(makeTrick(low.slice(lowIndex, lowIndex + 4), options.teams.defendingTeam[0]!, 1));
    lowIndex += 4;
  }

  const trickRound: TrickRound = {
    playerOrder: [0, 1, 2, 3],
    hands: [],
    currentTrick: { leader: 0, plays: [] },
    capturedTricks,
  };

  return {
    phase: "finished",
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    currentPlayer: undefined,
    hands: { 0: [], 1: [], 2: [], 3: [] },
    talon: options.talon ?? [],
    bids: [],
    passedPlayers: [],
    contract: options.contract,
    declarer: options.declarer,
    calledKing: undefined,
    teams: options.teams,
    pickedTalonGroupIndex: 0,
    talonGroups: [],
    discardedCards: options.discardedCards ?? [],
    announcementsRound: undefined,
    trickRound,
  };
}

describe("Pogoji zmage po pogodbah", () => {
  it("tri: partnerjev štih šteje za pogoj 'ena karta'", () => {
    // Deklarant 0 nima lastnega štiha, partner 1 pobere vse štíhe.
    const state = buildFinishedState({
      contract: "tri",
      teams: { declarerTeam: [0, 1], defendingTeam: [2, 3] },
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 0,
    });
    // Vsi štihi so dejansko pobrali igralci 0..3, zato popravimo zmagovalce
    // na partnerja 1 — pomembno je, da jih pobere AKTIVNA ekipa.
    const partnerOnly: GameState = {
      ...state,
      trickRound: {
        ...state.trickRound!,
        capturedTricks: state.trickRound!.capturedTricks.map((ct) => ({
          ...ct,
          winner: 1,
        })),
      },
    };

    const score = calculateGameScore(partnerOnly);
    expect(score.declarerTeam.cardPoints).toBeGreaterThanOrEqual(35);
    expect(score.isWin).toBe(true);
  });

  it("solo_brez ni valat: zmaga z 35+ točkami in vsaj enim štihom", () => {
    const state = buildFinishedState({
      contract: "solo_brez",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 1,
    });

    const score = calculateGameScore(state);
    expect(score.isWin).toBe(true);
    expect(score.razlika).toBe(0);
    expect(score.contractValue).toBe(80);
  });

  it("valat: en branilčev štih pomeni poraz", () => {
    const state = buildFinishedState({
      contract: "valat",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 1,
    });

    const score = calculateGameScore(state);
    expect(score.isWin).toBe(false);
    expect(score.contractValue).toBe(-500);
  });

  it("barvni valat: vsi štihi aktivne ekipe pomenijo zmago", () => {
    const state = buildFinishedState({
      contract: "barvni_valat",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 4,
      defenderTricks: 0,
    });

    const score = calculateGameScore(state);
    expect(score.isWin).toBe(true);
    expect(score.contractValue).toBe(125);
  });

  it("berač: brez pobranih štihov zmaga, z njim izgubi", () => {
    const winState = buildFinishedState({
      contract: "berac",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 0,
      defenderTricks: 3,
    });
    expect(calculateGameScore(winState).isWin).toBe(true);
    expect(calculateGameScore(winState).contractValue).toBe(70);

    const loseState = buildFinishedState({
      contract: "berac",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 1,
      defenderTricks: 2,
    });
    expect(calculateGameScore(loseState).isWin).toBe(false);
    expect(calculateGameScore(loseState).contractValue).toBe(-70);
  });
});

describe("settleGame", () => {
  const teams: Teams = { declarerTeam: [0, 1], defendingTeam: [2, 3] };

  it("zmago vpišeta samo člana aktivne ekipe; branilci ostanejo pri 0", () => {
    const state = buildFinishedState({
      contract: "tri",
      teams,
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 1,
    });

    const settlement = settleGame(state);
    expect(settlement.finalValue).toBeGreaterThan(0);
    expect(settlement.perPlayerDelta[0]).toBe(settlement.finalValue);
    expect(settlement.perPlayerDelta[1]).toBe(settlement.finalValue);
    expect(settlement.perPlayerDelta[2]).toBe(0);
    expect(settlement.perPlayerDelta[3]).toBe(0);
  });

  it("poraz vpiše aktivna ekipa v minus", () => {
    const state = buildFinishedState({
      contract: "tri",
      teams,
      declarer: 0,
      declarerTricks: 1,
      defenderTricks: 3,
    });

    const settlement = settleGame(state);
    expect(settlement.finalValue).toBeLessThan(0);
    expect(settlement.perPlayerDelta[0]).toBe(settlement.finalValue);
    expect(settlement.perPlayerDelta[1]).toBe(settlement.finalValue);
    expect(settlement.perPlayerDelta[2]).toBe(0);
  });

  it("solo: piše samo deklarant", () => {
    const state = buildFinishedState({
      contract: "solo_brez",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 1,
    });

    const settlement = settleGame(state);
    expect(settlement.finalValue).toBe(80);
    expect(settlement.perPlayerDelta[0]).toBe(80);
    expect(settlement.perPlayerDelta[1]).toBe(0);
    expect(settlement.perPlayerDelta[2]).toBe(0);
    expect(settlement.perPlayerDelta[3]).toBe(0);
  });

  it("uporabijo se le deklarantovi radlci in ob zmagi se izbrišejo", () => {
    const state = buildFinishedState({
      contract: "tri",
      teams,
      declarer: 0,
      declarerTricks: 3,
      defenderTricks: 1,
    });

    const base = settleGame(state);
    const withRadlci = settleGame(state, { radlci: { 0: 1, 1: 3, 2: 0, 3: 0 } });

    expect(withRadlci.radlciUsed).toBe(1);
    expect(withRadlci.finalValue).toBe(base.finalValue * 2);
    expect(withRadlci.radlciAfter[0]).toBe(0); // deklarant porabi radlc
    expect(withRadlci.radlciAfter[1]).toBe(3); // partnerjev radlc ostane
  });

  it("mondfang se prišteje le poražencu in se ne podvoji", () => {
    const high = pickHighCards();
    const low = pickLowCards(high);
    const mond = deck.find((c) => isTarokCard(c) && c.rank === 21)!;
    const skis = deck.find((c) => isTarokCard(c) && c.rank === "skis")!;

    const trickRound: TrickRound = {
      playerOrder: [0, 1, 2, 3],
      hands: [],
      currentTrick: { leader: 0, plays: [] },
      capturedTricks: [
        {
          winner: 1,
          trick: {
            leader: 0,
            plays: [
              { playerId: 0, card: mond },
              { playerId: 1, card: skis },
              { playerId: 2, card: low[0]! },
              { playerId: 3, card: low[1]! },
            ],
          },
        },
        ...high.slice(0, 8).reduce<ReturnType<typeof makeTrick>[]>((tricks, _card, index) => {
          if (index % 4 !== 0) return tricks;
          tricks.push(makeTrick(high.slice(index, index + 4), 1, 1));
          return tricks;
        }, []),
      ],
    };

    const state: GameState = {
      phase: "finished",
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      currentPlayer: undefined,
      hands: { 0: [], 1: [], 2: [], 3: [] },
      talon: [],
      bids: [],
      passedPlayers: [],
      contract: "tri",
      declarer: 0,
      calledKing: undefined,
        teams,
      pickedTalonGroupIndex: 0,
      talonGroups: [],
      discardedCards: [],
      announcementsRound: undefined,
      trickRound,
    };

    const score = calculateGameScore(state);
    expect(score.mondfang).toBe(-21);
    expect(score.mondfangPlayerId).toBe(0);

    const withoutRadlc = settleGame(state);
    const withRadlc = settleGame(state, { radlci: { 0: 1, 1: 0, 2: 0, 3: 0 } });

    // Razlika med obračunoma je natanko enkratno podvojena igra,
    // mondfang pa se ne podvoji.
    const deltaWithout = withoutRadlc.perPlayerDelta[0]!;
    const deltaWith = withRadlc.perPlayerDelta[0]!;
    expect(deltaWith - deltaWithout).toBe(withoutRadlc.finalValue);
    expect(deltaWith).toBe(withRadlc.finalValue - 21);
  });
});

describe("Klop obračun", () => {
  it("vsak igralec podvoji svoje točke s svojimi radlci; zmagovalcu se radlc izbriše", () => {
    const low = pickLowCards();
    // Trije štihi, vsak drug zmagovalec; igralec 3 ne pobere ničesar.
    const trickRound: TrickRound = {
      playerOrder: [0, 1, 2, 3],
      hands: [],
      currentTrick: { leader: 0, plays: [] },
      capturedTricks: [
        makeTrick(low.slice(0, 4), 0, 0),
        makeTrick(low.slice(4, 8), 1, 1),
        makeTrick(low.slice(8, 12), 2, 2),
      ],
    };

    const state: GameState = {
      phase: "finished",
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      currentPlayer: undefined,
      hands: { 0: [], 1: [], 2: [], 3: [] },
      talon: [],
      bids: [],
      passedPlayers: [],
      contract: "klop",
      declarer: undefined,
      calledKing: undefined,
        teams: undefined,
      pickedTalonGroupIndex: undefined,
      talonGroups: [],
      discardedCards: [],
      announcementsRound: undefined,
      trickRound,
    };

    const score = calculateGameScore(state);
    expect(score.klopWinners).toContain(3);

    const settlement = settleGame(state, { radlci: { 0: 0, 1: 1, 2: 0, 3: 2 } });
    expect(settlement.perPlayerDelta[1]).toBe(
      -(score.klopPlayerPoints?.[1] ?? 0) * 2,
    );
    expect(settlement.perPlayerDelta[3]).toBe(70 * 4);
    expect(settlement.radlciAfter[3]).toBe(0); // zmagovalcu se radlc izbriše
    expect(settlement.radlciAfter[1]).toBe(2); // 1 + novi radlc
  });
});
