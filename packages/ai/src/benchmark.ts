import {
  applyAction,
  calculateGameScore,
  canPlaceContra,
  createInitialGameState,
  createSeededRng,
  createTarokDeck,
  deal,
  getAnnouncementError,
  getExchangeCount,
  getHand,
  getLegalBidsForState,
  PASS,
  settleGame,
  shuffle,
  type GameAction,
  type GameState,
  type PlayerId,
} from "@tarok/engine";
import type { BotDifficulty } from "./bot/heuristic-bot.js";
import { HeuristicBot } from "./bot/heuristic-bot.js";
import type { TarokBot } from "./bot/random-bot.js";

export interface BenchmarkGameResult {
  seed: number;
  forehand: PlayerId;
  steps: number;
  finished: boolean;
  contract: string | null;
  declarer: PlayerId | null;
  declarerWon: boolean | null;
  error: string | null;
  cardPoints: number | null;
  cardPointsSum: number | null;
  perPlayerDelta: Record<PlayerId, number> | null;
}

export interface BenchmarkSummary {
  games: number;
  finished: number;
  errors: number;
  /** Ključ je pogodba, vrednost pa število zmag deklaranta/ekipe. */
  winsByContract: Record<string, number>;
  /** Ključ je pogodba, vrednost pa število iger. */
  gamesByContract: Record<string, number>;
  results: BenchmarkGameResult[];
}

export interface BenchmarkOptions {
  seeds?: readonly number[];
  difficulty?: BotDifficulty;
  maxSteps?: number;
}

const DEFAULT_SEEDS = Array.from({ length: 16 }, (_, index) => 1000 + index * 37);
const MAX_STEPS = 600;

function createGame(seed: number, forehand: PlayerId): GameState {
  const deck = shuffle(createTarokDeck(), createSeededRng(seed));
  const dealt = deal(deck, { playerCount: 4 });

  return createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand,
    initialHands: {
      0: dealt.hands[0]!,
      1: dealt.hands[1]!,
      2: dealt.hands[2]!,
      3: dealt.hands[3]!,
    },
    initialTalon: dealt.talon,
  });
}

function chooseAction(state: GameState, bots: readonly TarokBot[]): GameAction {
  const playerId = state.currentPlayer;
  if (playerId === undefined) throw new Error("Ni igralca na potezi");
  const bot = bots[playerId];
  if (!bot) throw new Error(`Ni bota za igralca ${playerId}`);

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
    case "raising":
      return {
        type: "raise",
        playerId,
        raise: bot.chooseRaiseToBarvniValat?.(state) ?? false,
      };
    case "announcements": {
      const contra = bot.chooseContra?.(state);
      if (
        contra !== undefined &&
        state.announcementsRound &&
        canPlaceContra(
          state.announcementsRound,
          playerId,
          contra,
          state.teams?.declarerTeam ?? (state.declarer !== undefined ? [state.declarer] : []),
        )
      ) {
        return { type: "contra", playerId, target: contra };
      }
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

/** Odigra eno igro z izbranimi boti in vrne povzetek. */
export function playBenchmarkGame(
  seed: number,
  forehand: PlayerId,
  difficulty: BotDifficulty = 3,
  maxSteps = MAX_STEPS,
): BenchmarkGameResult {
  const bots = [0, 1, 2, 3].map(
    (pid) => new HeuristicBot(pid as PlayerId, difficulty, createSeededRng(seed * 10 + pid)),
  );
  let state = createGame(seed, forehand);
  let steps = 0;
  let error: string | null = null;

  try {
    while (state.phase !== "finished" && steps < maxSteps) {
      state = applyAction(state, chooseAction(state, bots));
      steps++;
    }
  } catch (cause) {
    error = cause instanceof Error ? cause.message : String(cause);
  }

  const finished = state.phase === "finished";
  const base = {
    seed,
    forehand,
    steps,
    finished,
    contract: state.contract ?? null,
    declarer: state.declarer ?? null,
    declarerWon: null,
    error,
  };

  if (!finished || error !== null) {
    return {
      ...base,
      cardPoints: null,
      cardPointsSum: null,
      perPlayerDelta: null,
    };
  }

  const score = calculateGameScore(state);
  const settlement = settleGame(state, {
    radlci: { 0: 0, 1: 0, 2: 0, 3: 0 },
  });
  const isKlop = state.contract === "klop";
  const cardPointsSum = isKlop
    ? null
    : score.declarerTeam.cardPoints + score.defendingTeam.cardPoints;
  return {
    ...base,
    declarerWon: score.isWin,
    cardPoints: isKlop ? null : score.declarerTeam.cardPoints,
    cardPointsSum,
    perPlayerDelta: settlement.perPlayerDelta,
  };
}

/** Zažene benchmark čez izbrane seede in zbere statistiko po pogodbah. */
export function runBenchmark(options: BenchmarkOptions = {}): BenchmarkSummary {
  const seeds = options.seeds ?? DEFAULT_SEEDS;
  const difficulty = options.difficulty ?? 3;
  const maxSteps = options.maxSteps ?? MAX_STEPS;
  const results = seeds.map((seed, index) =>
    playBenchmarkGame(seed, (index % 4) as PlayerId, difficulty, maxSteps),
  );

  const winsByContract: Record<string, number> = {};
  const gamesByContract: Record<string, number> = {};

  for (const result of results) {
    if (!result.finished || result.contract === null) continue;
    gamesByContract[result.contract] = (gamesByContract[result.contract] ?? 0) + 1;
    if (result.error === null && result.declarerWon === true) {
      winsByContract[result.contract] = (winsByContract[result.contract] ?? 0) + 1;
    }
  }

  return {
    games: results.length,
    finished: results.filter((result) => result.finished).length,
    errors: results.filter((result) => result.error !== null).length,
    winsByContract,
    gamesByContract,
    results,
  };
}
