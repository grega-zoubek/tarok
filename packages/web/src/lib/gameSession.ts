import {
  applyAction,
  anyHandMissingTarok,
  createInitialGameState,
  createSeededRng,
  createTarokDeck,
  deal,
  shuffle,
  settleGame,
  getExchangeCount,
  getHand,
  getLegalBidsForState,
  getGameLegalPlays,
  getDiscardPool,
  isLegalDiscard,
  PASS,
  type GameAction,
  type GameState,
} from "@tarok/engine";
import { HeuristicBot } from "@tarok/ai";
import { isValidSettings, type PersistedSession } from "./session";
import type { GameSettings, RoundResult } from "../hooks/useTarokGame";

export interface SessionModel {
  session: PersistedSession | null;
  error: string | null;
}
export type SessionAction =
  | { type: "start"; settings: GameSettings; seed: number }
  | { type: "next"; seed: number }
  | { type: "apply"; actions: GameAction[]; expected: GameState; botRngStates?: number[] }
  | { type: "settle"; expected: GameState }
  | { type: "error"; message: string }
  | { type: "clearError" }
  | { type: "quit" };

export function createRound(
  session: PersistedSession,
  round: number,
  seed: number,
): PersistedSession {
  let compulsory = session.pendingCompulsoryKlop === true;
  let dealt: ReturnType<typeof deal> | undefined;
  let usedSeed = seed >>> 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    usedSeed = (seed + attempt) >>> 0;
    dealt = deal(shuffle(createTarokDeck(), createSeededRng(usedSeed)), { playerCount: 4 });
    if (!anyHandMissingTarok(dealt.hands)) break;
    compulsory = true;
  }
  if (!dealt || anyHandMissingTarok(dealt.hands))
    throw new Error("Kart ni bilo mogoče veljavno razdeliti.");
  const initial = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: (round - 1) % 4,
    initialHands: Object.fromEntries(dealt.hands.map((hand, pid) => [pid, hand])),
    initialTalon: dealt.talon,
    compulsoryKlop: compulsory,
  });
  const state = {
    ...initial,
    radlci: Object.fromEntries(session.radlci.map((r, pid) => [pid, r])),
  };
  return {
    ...session,
    round,
    seed: usedSeed,
    state,
    roundScore: null,
    pendingCompulsoryKlop: false,
    replay: {
      baseState: state,
      actions: [],
      botRngStates: [1, 2, 3].map((pid) => (Math.imul(usedSeed, 10) + pid) >>> 0),
    },
  };
}

/** One pure transaction for actions and settlement; persistence never sees half an update. */
export function sessionReducer(model: SessionModel, action: SessionAction): SessionModel {
  try {
    const session = model.session;
    switch (action.type) {
      case "error":
        return { ...model, error: action.message };
      case "clearError":
        return { ...model, error: null };
      case "quit":
        return { session: null, error: null };
      case "start": {
        if (!isValidSettings(action.settings)) throw new Error("Neveljavne nastavitve igre.");
        const settings = {
          ...action.settings,
          botConfigs: action.settings.botConfigs.map((b) => ({ ...b })),
        };
        const fresh: PersistedSession = {
          settings,
          round: 1,
          history: [],
          scores: [0, 0, 0, 0],
          radlci: [0, 0, 0, 0],
          seed: null,
          state: null,
          roundScore: null,
        };
        return { session: createRound(fresh, 1, action.seed), error: null };
      }
      case "next":
        if (
          !session?.roundScore ||
          session.state?.phase !== "finished" ||
          session.round >= session.settings.maxRounds
        )
          return model;
        return { session: createRound(session, session.round + 1, action.seed), error: null };
      case "apply": {
        if (
          !session?.state ||
          session.state !== action.expected ||
          session.roundScore ||
          model.error
        )
          return model;
        let state = session.state;
        for (const gameAction of action.actions) state = applyAction(state, gameAction);
        const replay = session.replay ?? {
          baseState: session.state,
          actions: [],
          botRngStates: [1, 2, 3].map((pid) => (Math.imul(session.seed ?? 0, 10) + pid) >>> 0),
        };
        return {
          error: null,
          session: {
            ...session,
            state,
            replay: {
              baseState: replay.baseState,
              actions: [...replay.actions, ...action.actions],
              botRngStates: action.botRngStates ?? replay.botRngStates,
            },
          },
        };
      }
      case "settle": {
        if (
          !session?.state ||
          session.state !== action.expected ||
          session.state.phase !== "finished" ||
          session.roundScore
        )
          return model;
        const settlement = settleGame(session.state, {
          radlci: Object.fromEntries(session.radlci.map((r, i) => [i, r])),
        });
        // A legacy/session-repair case can lack roundScore but already contain a history entry.
        if (session.history.some((r) => r.round === session.round)) {
          return { ...model, session: { ...session, roundScore: settlement.score } };
        }
        const score = settlement.score;
        const deltas = [0, 1, 2, 3].map((pid) => settlement.perPlayerDelta[pid] ?? 0);
        const scores = session.scores.map((s, i) => s + deltas[i]!);
        const names = [
          session.settings.humanName,
          ...session.settings.botConfigs.map((b) => b.name),
        ];
        const result: RoundResult = {
          round: session.round,
          contract: session.state.contract ?? "klop",
          declarer: session.state.declarer === undefined ? "Nihče" : names[session.state.declarer]!,
          razlika: score.razlika,
          valueBeforeRadlci: score.totalBeforeRadlci,
          finalValue: session.state.contract === "klop" ? deltas[0]! : settlement.finalValue,
          radlciUsed: settlement.radlciUsed,
          mondfang: score.mondfang,
          mondfangPlayerId: score.mondfangPlayerId,
          newRadlciEarned: score.newRadlciEarned,
          winnerTeam:
            session.state.contract === "klop" ? "klop" : score.isWin ? "declarer" : "defenders",
          perPlayerDelta: deltas,
          klopPlayerPoints: score.klopPlayerPoints,
          klopWinners: score.klopWinners,
          klopLosers: score.klopLosers,
        };
        return {
          error: null,
          session: {
            ...session,
            roundScore: score,
            scores,
            radlci: [0, 1, 2, 3].map((pid) => settlement.radlciAfter[pid] ?? 0),
            history: [...session.history, result],
            pendingCompulsoryKlop: scores.some((s, i) => s === 0 && deltas[i] !== 0),
          },
        };
      }
    }
  } catch (error) {
    return { ...model, error: error instanceof Error ? error.message : "Neznana napaka igre." };
  }
}

/** RNG is recreated from saved state on each turn, so reloads do not change decisions. */
export function chooseBotTurn(session: PersistedSession): {
  actions: GameAction[];
  botRngStates: number[];
} {
  const state = session.state;
  const pid = state?.currentPlayer;
  if (!state || pid === undefined || pid === 0) throw new Error("Ni bota na potezi.");
  const rngStates = [
    ...(session.replay?.botRngStates ??
      [1, 2, 3].map((id) => (Math.imul(session.seed ?? 0, 10) + id) >>> 0)),
  ];
  const config = session.settings.botConfigs[pid - 1]!;
  const rng = createSeededRng(rngStates[pid - 1]!);
  const bot = new HeuristicBot(pid, config.difficulty, rng);
  const actions: GameAction[] = [];
  switch (state.phase) {
    case "bidding": {
      let bid = bot.chooseBid(state);
      if (bid !== PASS && !getLegalBidsForState(state).includes(bid)) bid = PASS;
      actions.push({ type: "bid", playerId: pid, action: bid });
      break;
    }
    case "calling":
      actions.push({ type: "call", playerId: pid, suit: bot.chooseCalledKing(state) });
      break;
    case "talon": {
      if (state.pickedTalonGroupIndex === undefined)
        actions.push({ type: "talonPick", playerId: pid, groupIndex: bot.chooseTalonGroup(state) });
      else {
        const hand = getHand(state, pid);
        const count = getExchangeCount(state.contract);
        let discards = bot.chooseDiscards(state, hand, count);
        if (discards.length !== count || !isLegalDiscard(discards, hand))
          discards = getDiscardPool(hand, count).slice(0, count);
        actions.push({ type: "discard", playerId: pid, cards: discards });
      }
      break;
    }
    case "raising":
      actions.push({ type: "raise", playerId: pid, raise: bot.chooseRaiseToBarvniValat(state) });
      break;
    case "announcements": {
      let current = state;
      const contra = bot.chooseContra(current);
      if (contra) {
        const action: GameAction = { type: "contra", playerId: pid, target: contra };
        current = applyAction(current, action);
        actions.push(action);
      }
      for (const announcement of bot.chooseAnnouncements(current)) {
        const action: GameAction = { type: "announce", playerId: pid, announcement };
        current = applyAction(current, action);
        actions.push(action);
      }
      actions.push({ type: "announcePass", playerId: pid });
      break;
    }
    case "playing": {
      const hand = getHand(state, pid);
      const chosen = bot.choosePlay(state, hand);
      const legal = getGameLegalPlays(state, pid, hand);
      actions.push({
        type: "play",
        playerId: pid,
        card: legal.find((c) => c === chosen) ?? legal[0]!,
      });
      break;
    }
    default:
      throw new Error("Bot v tej fazi ne more igrati.");
  }
  rngStates[pid - 1] = rng.getState();
  return { actions, botRngStates: rngStates };
}
