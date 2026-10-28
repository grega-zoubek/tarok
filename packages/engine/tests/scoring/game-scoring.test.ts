import { describe, it, expect } from "vitest";
import { calculateGameScore } from "../../src/scoring/game-scoring.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import type { GameState } from "../../src/state/state.js";
import type { TrickRound } from "../../src/game/trick-round.js";
import { countPoints } from "../../src/scoring/scoring.js";

function createMockFinishedGameState(): GameState {
  const deck = createTarokDeck();
  const declarerHand = deck.slice(0, 12);
  const def1 = deck.slice(12, 24);
  const def2 = deck.slice(24, 36);
  const def3 = deck.slice(36, 48);
  const talon = deck.slice(48, 54);

  // Declarer takes first 3 talon cards, leaves 3
  const discarded = talon.slice(0, 3);
  const unpicked = talon.slice(3, 6);

  // Let's manually construct trick captures
  // Declarer wins the first trick with 4 cards
  // Defenders win the rest.
  const trickRound: TrickRound = {
    playerOrder: [0, 1, 2, 3],
    hands: [],
    currentTrick: { leader: 0, plays: [] },
    capturedTricks: [
      {
        winner: 0, // Declarer
        trick: {
          leader: 0,
          plays: [
            { playerId: 0, card: declarerHand[0]! },
            { playerId: 1, card: def1[0]! },
            { playerId: 2, card: def2[0]! },
            { playerId: 3, card: def3[0]! },
          ],
        },
      },
      // Defenders (player 1) wins everything else
      {
        winner: 1,
        trick: {
          leader: 1,
          plays: [
            { playerId: 1, card: def1[1]! },
            { playerId: 2, card: def2[1]! },
            { playerId: 3, card: def3[1]! },
            { playerId: 0, card: declarerHand[1]! },
          ],
        },
      },
    ],
  };

  return {
    phase: "finished",
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    currentPlayer: undefined,
    hands: { 0: [], 1: [], 2: [], 3: [] },
    talon,
    bids: [],
    passedPlayers: [],
    contract: "tri",
    declarer: 0,
    calledKing: undefined, // Plays alone
    teams: {
      declarerTeam: [0],
      defendingTeam: [1, 2, 3],
    },
    announcementsRound: undefined,
    pickedTalonGroupIndex: 0,
    discardedCards: discarded,
    calledKingInPickedTalon: false,
    remainingTalonToDeclarer: false,
    talonGroups: [],
    radlci: { 0: 0, 1: 0, 2: 0, 3: 0 },
    trickRound,
    compulsoryKlop: false,
  };
}

describe("Game Scoring", () => {
  it("throws if the game is not finished", () => {
    const state = createMockFinishedGameState();
    const playingState = { ...state, phase: "playing" } as GameState;
    expect(() => calculateGameScore(playingState)).toThrowError();
  });

  it("berač: trula in kralji se ne štejejo", () => {
    // Berač: deklarant mora vzeti 0 štihov.
    // Ker je vzel štih (winner=0 v prvem štihu), je izgubil.
    // Trula / kralji se NE smejo pojaviti v bonusih.
    const state = createMockFinishedGameState();
    const beracState: GameState = {
      ...state,
      contract: "berac",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(beracState);
    // Ni trule / kraljev v bonusih
    const hasTrulaBonus  = result.bonuses.some(b => b.type === "trula");
    const hasKraljiBonus = result.bonuses.some(b => b.type === "kralji");
    expect(hasTrulaBonus,  "berač ne sme šteti trule").toBe(false);
    expect(hasKraljiBonus, "berač ne sme šteti kraljev").toBe(false);
    // Poraz: deklarant je vzel štih (winner=0)
    expect(result.isWin).toBe(false);
    // Vrednost = −base (70)
    expect(result.contractValue).toBe(-70);
    expect(result.totalBeforeRadlci).toBe(-70);
  });

  it("solo_brez: trula in kralji se ne štejejo", () => {
    const state = createMockFinishedGameState();
    const soloBrezState: GameState = {
      ...state,
      contract: "solo_brez",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(soloBrezState);
    expect(result.bonuses.some(b => b.type === "trula")).toBe(false);
    expect(result.bonuses.some(b => b.type === "kralji")).toBe(false);
  });

  it("solo_brez: zmaga je ≥36 točk (ne vsi štihi), vrednost flat ±80", () => {
    const state = createMockFinishedGameState();
    // Deklarant vzame 1 od 2 štihov — to NI valat, a lahko še vedno zmaga solo brez.
    const soloBrezState: GameState = {
      ...state,
      contract: "solo_brez",
      discardedCards: [], // solo brez nima zaloge
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(soloBrezState);
    expect(result.razlika).toBe(0);
    if (result.declarerTeam.cardPoints > 35) {
      expect(result.isWin).toBe(true);
      expect(result.contractValue).toBe(80);
    } else {
      expect(result.isWin).toBe(false);
      expect(result.contractValue).toBe(-80);
    }
    // Z enim izgubljenim štihom to NI "vsi štihi" — a isWin sledi točkam, ne štihom
    const wonAll =
      result.declarerTeam.collectedCards.length > 0 &&
      soloBrezState.trickRound!.capturedTricks.every((t) => t.winner === 0);
    expect(wonAll).toBe(false);
  });

  it("navadna pogodba: 36 točk zmaga, ≤35 poraz", () => {
    // 8 kingov = točno 35 točk (raw 40 − 5 = 35).
    const kings = Array.from({ length: 8 }, (_, i) => ({
      kind: "suit" as const,
      suit: (["hearts", "diamonds", "clubs", "spades"] as const)[i % 4]!,
      rank: "king" as const,
    }));
    expect(countPoints(kings)).toBe(35);

    const state = createMockFinishedGameState();
    const lowTarokTrick = {
      winner: 0,
      trick: {
        leader: 0,
        plays: [
          { playerId: 0, card: { kind: "tarok" as const, rank: 2 as const, name: "ii" as const } },
          { playerId: 1, card: { kind: "tarok" as const, rank: 3 as const, name: "iii" as const } },
          { playerId: 2, card: { kind: "tarok" as const, rank: 4 as const, name: "iiii" as const } },
          { playerId: 3, card: { kind: "tarok" as const, rank: 5 as const, name: "v" as const } },
        ],
      },
    };
    // 8 kingov (35) + 4 nizki taroki (+1) = 36 → zmaga
    const at36: GameState = {
      ...state,
      discardedCards: kings,
      talon: [],
      trickRound: {
        playerOrder: [0, 1, 2, 3],
        hands: [],
        currentTrick: { leader: 0, plays: [] },
        capturedTricks: [lowTarokTrick],
      },
    };
    const win = calculateGameScore(at36);
    expect(win.declarerTeam.cardPoints).toBe(36);
    expect(win.isWin).toBe(true);

    // 7 kingov (30) +1 = 31 → poraz
    const under: GameState = { ...at36, discardedCards: kings.slice(0, 7) };
    const loss = calculateGameScore(under);
    expect(loss.declarerTeam.cardPoints).toBeLessThanOrEqual(35);
    expect(loss.isWin).toBe(false);
  });

  it("tri: trula se šteje samo če ENA ekipa pobere VSE 3 karte", () => {
    // V mock stanju karte niso razporejene tako da bi ena ekipa imela vso trulo —
    // zato se pri razdeljeneni truli NE sme nič šteti.
    const state = createMockFinishedGameState();
    const result = calculateGameScore(state);
    // Preverimo da bonusi niso prisotni za razdeljeno trulo / kralje
    // (mock deck je naključen — samo preverimo da ni napačnega štetja)
    for (const bonus of result.bonuses) {
      if (bonus.type === "trula" || bonus.type === "kralji") {
        // Če je bonus prisoten, mora biti announcedBy !== "silent"
        // ALI mora biti ena ekipa res imela vse karte
        const allWithDeclarer = bonus.type === "trula"
          ? result.declarerTeam.wonTrula
          : result.declarerTeam.wonKings;
        const allWithDefenders = bonus.type === "trula"
          ? result.defendingTeam.wonTrula
          : result.defendingTeam.wonKings;
        // Bonus je dovoljen le če ga je kdo napovedal ali ena ekipa ima vse
        const announced = bonus.announcedBy !== "silent";
        expect(allWithDeclarer || allWithDefenders || announced,
          `${bonus.type} ne sme biti ocenjen pri razdeljeni truli/kraljih brez napovedi`
        ).toBe(true);
      }
    }
  });

  it("berač: zgodnja prekinitev ko deklarant vzame štih (dispatchPlay)", () => {
    // Simuliramo dispatchPlay ki konča igro takoj ob berač štihu
    // Preverimo le z game-scoring da ni trule/kraljev
    const state = createMockFinishedGameState();
    const beracState: GameState = {
      ...state,
      contract: "berac",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const score = calculateGameScore(beracState);
    expect(score.isWin).toBe(false);   // Vzel štih → poraz
    expect(score.contractValue).toBeLessThan(0); // Negativno
  });

  it("calculates exact points for declarer and defending team", () => {
    const state = createMockFinishedGameState();
    const result = calculateGameScore(state);

    expect(result.declarerTeam.collectedCards.length).toBe(7); // 4 from trick, 3 from discard
    // Uncollected talon goes to defenders
    expect(result.uncollectedCards.length).toBe(3);
    expect(result.defendingTeam.collectedCards.length).toBe(7); // 4 from trick, 3 unpicked talon

    // Let's verify sum of points
    const decPts = countPoints(result.declarerTeam.collectedCards);
    const defPts = countPoints(result.defendingTeam.collectedCards);
    
    expect(result.declarerTeam.cardPoints).toBe(decPts);
    expect(result.defendingTeam.cardPoints).toBe(defPts);
    
    // Total should equal countPoints of all those 14 cards (this might not be exactly 70 because we only used a subset of deck for tricks)
    expect(result.isWin).toBe(decPts > 35);
  });

  it("solo_tri ima vrednost 40 + razlika (4 igralci)", () => {
    const state = createMockFinishedGameState();
    const soloTri: GameState = {
      ...state,
      contract: "solo_tri",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(soloTri);
    if (result.isWin) {
      expect(result.contractValue).toBe(40 + result.razlika);
    } else {
      expect(result.contractValue).toBe(-40 + result.razlika);
    }
  });

  it("solo_dve ima vrednost 50 + razlika (4 igralci)", () => {
    const state = createMockFinishedGameState();
    const soloDve: GameState = {
      ...state,
      contract: "solo_dve",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(soloDve);
    if (result.isWin) {
      expect(result.contractValue).toBe(50 + result.razlika);
    } else {
      expect(result.contractValue).toBe(-50 + result.razlika);
    }
  });

  it("solo_ena ima vrednost 60 + razlika (4 igralci)", () => {
    const state = createMockFinishedGameState();
    const soloEna: GameState = {
      ...state,
      contract: "solo_ena",
      teams: { declarerTeam: [0], defendingTeam: [1, 2, 3] },
    };
    const result = calculateGameScore(soloEna);
    if (result.isWin) {
      expect(result.contractValue).toBe(60 + result.razlika);
    } else {
      expect(result.contractValue).toBe(-60 + result.razlika);
    }
  });

  it("tri/dve/ena zmaga zahteva, da deklarant pobare vsaj 1 štih", () => {
    // "35 točk in ena karta" — deklarant mora vzeti vsaj 1 štih, ne samo založke.
    const state = createMockFinishedGameState();
    // V mock stanju deklarant (0) osvoji prvi štih. Spremenimo vse štibe v branilčeve.
    const noTrickState: GameState = {
      ...state,
      trickRound: {
        ...state.trickRound!,
        capturedTricks: state.trickRound!.capturedTricks.map(ct =>
          ct.winner === 0 ? { ...ct, winner: 1 } : ct
        ),
      },
    };
    const result = calculateGameScore(noTrickState);
    // Declarer nima nobenega osvojenega štiha → ni zmaga ("ena karta" pravilo).
    expect(result.isWin).toBe(false);
  });
});
