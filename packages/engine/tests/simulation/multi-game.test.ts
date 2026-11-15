/**
 * QA test: simulira 8 zaporednih iger (kot v pravem igranju) z engine
 * reducerjem `applyAction` in obračunom `settleGame`.
 *
 * Preverja:
 *  1. vsaka igra se zaključi (phase === "finished"),
 *  2. skupne točke kart so 70,
 *  3. obračun je ničeln za vse igre razen klopa in mondfanga,
 *  4. radlci se pravilno posodabljajo (nikoli negativni),
 *  5. replay iz seeda + zapisa akcij da identično končno stanje.
 */
import { describe, it, expect } from "vitest";
import {
  createTarokDeck, shuffle, deal, createInitialGameState, createSeededRng,
  applyAction, getAnnouncementError, getExchangeCount, getHand, getLegalBidsForState,
  settleGame, calculateGameScore, PASS,
  type GameAction, type GameState, type PlayerId,
} from "../../src/index.js";
import { HeuristicBot } from "../../../ai/src/bot/heuristic-bot.js";

const MAX_STEPS = 600;

function createGame(seed: number, forehand: PlayerId): GameState {
  const deck = shuffle(createTarokDeck(), createSeededRng(seed));
  const dealResult = deal(deck, { playerCount: 4 });

  return createInitialGameState({
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
}

function createBots(seed: number): HeuristicBot[] {
  return [0, 1, 2, 3].map(
    (pid) => new HeuristicBot(pid as PlayerId, 4, createSeededRng(seed * 10 + pid)),
  );
}

/** Izbere naslednjo akcijo za igralca na potezi. */
function chooseAction(state: GameState, bots: HeuristicBot[]): GameAction {
  const playerId = state.currentPlayer;
  if (playerId === undefined) throw new Error("Ni igralca na potezi");
  const bot = bots[playerId]!;

  switch (state.phase) {
    case "bidding": {
      let bid = bot.chooseBid(state);
      if (bid !== PASS && !getLegalBidsForState(state).includes(bid)) {
        bid = PASS;
      }
      return { type: "bid", playerId, action: bid };
    }
    case "calling":
      return { type: "call", playerId, suit: bot.chooseCalledKing(state) };
    case "talon":
      return state.pickedTalonGroupIndex === undefined
        ? { type: "talonPick", playerId, groupIndex: bot.chooseTalonGroup(state) }
        : {
            type: "discard",
            playerId,
            cards: bot.chooseDiscards(
              state,
              getHand(state, playerId),
              getExchangeCount(state.contract),
            ),
          };
    case "announcements": {
      const announcement = bot
        .chooseAnnouncements(state)
        .find((type) => getAnnouncementError(state, playerId, type) === undefined);
      return announcement !== undefined
        ? { type: "announce", playerId, announcement }
        : { type: "announcePass", playerId };
    }
    case "playing":
      return { type: "play", playerId, card: bot.choosePlay(state, getHand(state, playerId)) };
    default:
      throw new Error(`Nepričakovana faza ${state.phase}`);
  }
}

function playOneGame(seed: number, forehand: PlayerId): { state: GameState; actions: GameAction[] } {
  let state = createGame(seed, forehand);
  const bots = createBots(seed);
  const actions: GameAction[] = [];

  let steps = 0;
  while (state.phase !== "finished" && steps < MAX_STEPS) {
    const action = chooseAction(state, bots);
    actions.push(action);
    state = applyAction(state, action);
    steps++;
  }

  return { state, actions };
}

describe("QA: 8 zaporednih iger", () => {
  it("igre se zaključijo, obračun je ničeln in radlci konsistentni", () => {
    const seeds = [1001, 2002, 3003, 4004, 5005, 6006, 7007, 8008];
    const radlci: Record<PlayerId, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    seeds.forEach((seed, roundIndex) => {
      const forehand = (roundIndex % 4) as PlayerId;
      const { state } = playOneGame(seed, forehand);

      expect(state.phase, `Igra ${roundIndex + 1} se ni zaključila`).toBe("finished");

      const settlement = settleGame(state, { radlci });

      // Vsota kart je vedno 70.
      if (state.contract !== "klop") {
        const score = calculateGameScore(state);
        expect(
          score.declarerTeam.cardPoints + score.defendingTeam.cardPoints,
          `Igra ${roundIndex + 1}: vsota kart ni 70`,
        ).toBe(70);
      }

      // Ničelna vsota: mondfang je edina izjema (−21 samo poražencu).
      const totalDelta = state.playerOrder.reduce(
        (sum, pid) => sum + (settlement.perPlayerDelta[pid] ?? 0),
        0,
      );
      if (state.contract === "klop") {
        expect(Number.isFinite(totalDelta)).toBe(true);
      } else if (settlement.score.mondfang === 0) {
        expect(totalDelta, `Igra ${roundIndex + 1}: vsota delt ni 0`).toBe(0);
      } else {
        expect(totalDelta, `Igra ${roundIndex + 1}: mondfang naj bo −21`).toBe(-21);
      }

      // Radlci po obračunu so nenegativni.
      for (const pid of state.playerOrder) {
        expect(settlement.radlciAfter[pid]).toBeGreaterThanOrEqual(0);
        radlci[pid] = settlement.radlciAfter[pid]!;
      }
    });
  });

  it("replay iz seeda in zapisa akcij da identično končno stanje", () => {
    const seed = 4242;
    const forehand: PlayerId = 1;
    const { state, actions } = playOneGame(seed, forehand);

    let replay = createGame(seed, forehand);
    for (const action of actions) {
      replay = applyAction(replay, action);
    }

    expect(replay.phase).toBe("finished");
    expect(replay.contract).toBe(state.contract);
    expect(replay.declarer).toBe(state.declarer);
    expect(replay.hands).toEqual(state.hands);
    expect(replay.trickRound?.capturedTricks).toEqual(state.trickRound?.capturedTricks);
  });
});
