import type { GameScoreResult, GameState } from "@tarok/engine";
import type { GameSettings, RoundResult } from "../hooks/useTarokGame";

export const SESSION_STORAGE_KEY = "tarokSession";

export interface PersistedSession {
  settings: GameSettings;
  round: number;
  history: RoundResult[];
  scores: number[];
  radlci: number[];
  seed: number | null;
  state: GameState | null;
  /** Rezultat tekočega kroga; prepreči ponoven obračun ob obnovitvi. */
  roundScore: GameScoreResult | null;
}

const DEFAULT_SCORES = [0, 0, 0, 0];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "number");
}

/**
 * Prebere shranjeno sejo iz `sessionStorage`. Vrne `null`, če je zapis
 * manjkajoč, poškodovan ali nima obveznih nastavitev.
 */
export function parseSession(raw: string | null): PersistedSession | null {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;

  const { settings, round, hist, scores, radlci, seed, state, score } = parsed;
  if (!isRecord(settings) || typeof round !== "number" || !Number.isFinite(round)) {
    return null;
  }
  if (
    typeof settings.humanName !== "string" ||
    !Array.isArray(settings.botConfigs) ||
    typeof settings.maxRounds !== "number"
  ) {
    return null;
  }

  const restoredState =
    isRecord(state) && typeof state.phase === "string"
      ? (state as unknown as GameState)
      : null;
  const restoredRoundScore =
    isRecord(score) && typeof score.isWin === "boolean"
      ? (score as unknown as GameScoreResult)
      : null;

  return {
    settings: settings as unknown as GameSettings,
    round,
    history: Array.isArray(hist) ? (hist as RoundResult[]) : [],
    scores: isNumberArray(scores) ? scores : [...DEFAULT_SCORES],
    radlci: isNumberArray(radlci) ? radlci : [...DEFAULT_SCORES],
    seed: typeof seed === "number" && Number.isFinite(seed) ? seed : null,
    state: restoredState,
    roundScore: restoredRoundScore,
  };
}

/** Serializira sejo v obliko, ki jo shranjujemo v `sessionStorage`. */
export function serializeSession(session: PersistedSession): string {
  return JSON.stringify({
    settings: session.settings,
    round: session.round,
    hist: session.history,
    scores: session.scores,
    radlci: session.radlci,
    seed: session.seed,
    state: session.state,
    score: session.roundScore,
  });
}
