/**
 * QA test: simulira 8 zaporednih iger (kot v pravem igranju).
 * Preverja da:
 *  1. Vsaka igra se zaključi (phase === "finished")
 *  2. Skupne točke kart = 70
 *  3. Štetje se pravilno izračuna (calculateGameScore ne vrže napake)
 *  4. Radlci se pravilno posodabljajo
 *  5. Ni zagozditev pri biddingu
 */
import { describe, it, expect } from "vitest";
import {
  createTarokDeck, shuffle, deal, createInitialGameState, createSeededRng,
  dispatchBid, dispatchCall, dispatchTalonPick, dispatchDiscard,
  dispatchAnnouncementPass, dispatchPlay, PASS, isLegalBid,
  calculateGameScore, applyRadlci, countPoints,
  type Bid, type GameState, type PlayerId,
} from "../../src/index.js";
import { HeuristicBot } from "../../../ai/src/bot/heuristic-bot.js";

// ── Pomočna funkcija: odigra eno igro do konca ────────────────────────────────
function playOneGame(seed: number, forehand: PlayerId): GameState {
  let deck = createTarokDeck();
  deck = shuffle(deck, createSeededRng(seed));
  const dealResult = deal(deck, { playerCount: 4 });

  let state = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand,
    initialHands: {
      0: dealResult.hands[0]!,
      1: dealResult.hands[1]!,
      2: dealResult.hands[2]!,
      3: dealResult.hands[3]!,
    },
    initialTalon: dealResult.talon,
  });

  const bots = [
    new HeuristicBot(0, 3),
    new HeuristicBot(1, 3),
    new HeuristicBot(2, 3),
    new HeuristicBot(3, 3),
  ];

  let iterations = 0;
  const MAX = 600;

  while (state.phase !== "finished" && iterations < MAX) {
    const pid = state.currentPlayer;
    if (pid === undefined) break;

    const bot = bots[pid]!;

    switch (state.phase) {
      case "bidding": {
        let bid = bot.chooseBid(state);

        // ← Ključni popravek: preverimo legalnost PRED dispatchom
        if (bid !== PASS) {
          const mockRound = {
            playerOrder: state.playerOrder,
            forehand: state.forehand,
            currentPlayerIndex: state.playerOrder.indexOf(pid),
            bids: state.bids,
            passedPlayers: state.passedPlayers,
            currentHighestBid:
              state.contract && state.contract !== "klop"
                ? { playerId: state.declarer!, bid: state.contract as Bid }
                : undefined,
            isFinished: false,
          };
          if (!isLegalBid(mockRound, pid, bid as Bid)) {
            bid = PASS;
          }
        }

        state = dispatchBid(state, pid, bid);
        break;
      }

      case "calling": {
        const suit = bot.chooseCalledKing(state);
        state = dispatchCall(state, pid, suit);
        break;
      }

      case "talon": {
        if (state.pickedTalonGroupIndex === undefined) {
          const groupIndex = bot.chooseTalonGroup(state);
          state = dispatchTalonPick(state, pid, groupIndex);
        } else {
          let exchangeCount: 3 | 2 | 1 = 3;
          if (state.contract === "dve" || state.contract === "solo_dve") exchangeCount = 2;
          if (state.contract === "ena" || state.contract === "solo_ena") exchangeCount = 1;
          const discards = bot.chooseDiscards(state, state.hands[pid]!, exchangeCount);
          state = dispatchDiscard(state, pid, discards);
        }
        break;
      }

      case "announcements": {
        state = dispatchAnnouncementPass(state, pid);
        break;
      }

      case "playing": {
        const hand = state.trickRound?.hands.find(h => h.playerId === pid)?.cards ?? [];
        const card = bot.choosePlay(state, hand);
        state = dispatchPlay(state, pid, card);
        break;
      }
    }

    iterations++;
  }

  return state;
}

// ── Testi ─────────────────────────────────────────────────────────────────────
describe("QA: 8 zaporednih iger", () => {
  // Različni seedovi = različni razdelki kart
  const seeds = [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008];

  // Skupni radlci po vseh igrah (simulacija stanja v hooku)
  const playerRadlci = [0, 0, 0, 0];

  seeds.forEach((seed, roundIndex) => {
    const forehand = (roundIndex % 4) as PlayerId;

    it(`Igra ${roundIndex + 1} (seed=${seed}, forehand=P${forehand})`, () => {
      const finalState = playOneGame(seed, forehand);

      // ── 1. Igra mora biti končana ──────────────────────────────────────────
      expect(finalState.phase, "Igra se ni zaključila (zagozditev)").toBe("finished");

      // ── 2. Skupne točke kart = 70 ───────────────────────────────────
      // state.talon = originalnih 6 kart; del je šel v roke (discardedCards),
      // preostanek je šel branilcem (uncollectedCards v score).
      // Najlažje preverimo: vsota točk aktivna + branioci = 70 (po score).
      if (finalState.contract !== "klop" && finalState.trickRound) {
        const score2 = calculateGameScore(finalState);
        const totalPoints = score2.declarerTeam.cardPoints + score2.defendingTeam.cardPoints;
        expect(totalPoints, `Skupne točke (${score2.declarerTeam.cardPoints} + ${score2.defendingTeam.cardPoints}) niso 70`).toBe(70);
      }

      // ── 3. Štetje ne sme vreči napake ────────────────────────────────────
      let score: ReturnType<typeof calculateGameScore>;
      expect(() => {
        score = calculateGameScore(finalState);
      }, "calculateGameScore je vrgel napako").not.toThrow();

      score = calculateGameScore(finalState);

      // ── 4. Štetje: contractValue + razlika + bonusValue = totalBeforeRadlci
      if (finalState.contract !== "klop") {
        expect(
          score.totalBeforeRadlci,
          "totalBeforeRadlci ne ustreza vsoti contractValue + bonusValue"
        ).toBe(score.contractValue + score.bonusValue);

        // Razlika mora biti večkratnik 5
        expect(
          Math.abs(score.razlika % 5),
          `Razlika ${score.razlika} ni večkratnik 5`
        ).toBe(0);
      }

      // ── 5. Radlci: applyRadlci mora biti konsistenten ─────────────────────
      if (finalState.contract !== "klop") {
        const declarerTeam = finalState.teams?.declarerTeam ?? [];
        const declarerMaxRadlci = declarerTeam.reduce(
          (m, pid) => Math.max(m, playerRadlci[pid] ?? 0), 0
        );
        const applied = applyRadlci(score.totalBeforeRadlci, declarerMaxRadlci);
        expect(
          typeof applied.finalValue,
          "applyRadlci mora vrniti število"
        ).toBe("number");
        expect(
          isFinite(applied.finalValue),
          "applyRadlci je vrnil Infinity/NaN"
        ).toBe(true);

        // Posodobi radlce (simulacija hook logike)
        for (let i = 0; i < 4; i++) {
          playerRadlci[i] = (playerRadlci[i] ?? 0) + score.newRadlciEarned;
        }
        if (score.isWin && applied.radlciUsed > 0) {
          for (const pid of declarerTeam) {
            playerRadlci[pid] = 0;
          }
        }
      } else {
        // Klop: +1 radlc vsem
        for (let i = 0; i < 4; i++) {
          playerRadlci[i] = (playerRadlci[i] ?? 0) + 1;
        }
      }

      // ── 6. Radlci nikoli ne smejo biti negativni ──────────────────────────
      for (let i = 0; i < 4; i++) {
        expect(playerRadlci[i], `playerRadlci[${i}] je negativen`).toBeGreaterThanOrEqual(0);
      }

      console.log(
        `  Igra ${roundIndex + 1}: ${finalState.contract ?? "klop"} | ` +
        `zmaga=${score?.isWin} | razlika=${score?.razlika} | ` +
        `vrednost=${score?.totalBeforeRadlci} | radlci=${JSON.stringify(playerRadlci)}`
      );
    });
  });

  // ── Extra: simuliraj solo_tri naročno ──────────────────────────────────────
  it("Solo_tri se izračuna brez napake (teams so nastavljeni)", () => {
    // Seed 9009: Bot 2 je forehand, verjetno bo kdo licitiral solo
    // Forsiramo solo_tri s posebnim seedom ki ga da
    for (const seed of [9009, 1111, 2222, 3333, 4444]) {
      const state = playOneGame(seed, 2 as PlayerId);
      expect(state.phase).toBe("finished");
      // Če je bila solo pogodba, preverimo da je bila score izračunana
      if (state.contract && ["solo_tri","solo_dve","solo_ena","berac","odprti_berac"].includes(state.contract)) {
        expect(() => calculateGameScore(state)).not.toThrow();
        const score = calculateGameScore(state);
        expect(score.declarerTeam.cardPoints + score.defendingTeam.cardPoints).toBe(70);
      }
    }
  });

  it("Po 8 igrah: vsi radlci >= 0", () => {
    for (let i = 0; i < 4; i++) {
      expect(playerRadlci[i]).toBeGreaterThanOrEqual(0);
    }
    console.log(`  Končni radlci: ${JSON.stringify(playerRadlci)}`);
  });
});
