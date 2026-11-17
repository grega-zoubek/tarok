import {
  ANNOUNCEMENTS,
  BIDS,
  PASS,
  applyAction,
  cardKey,
  createTarokDeck,
  getCurrentPlayer,
  getCurrentAnnouncingPlayer,
  type Card,
  type GameAction,
  type GameScoreResult,
  type GameState,
} from "@tarok/engine";
import type { GameSettings, RoundResult } from "../hooks/useTarokGame";

export const SESSION_STORAGE_KEY = "tarokSession";
export const SESSION_VERSION = 2;

export interface RoundReplay {
  /** Initial round, or a validated legacy snapshot from which logging starts. */
  baseState: GameState;
  actions: GameAction[];
  botRngStates: number[];
}

export interface PersistedSession {
  settings: GameSettings;
  round: number;
  history: RoundResult[];
  scores: number[];
  radlci: number[];
  seed: number | null;
  state: GameState | null;
  roundScore: GameScoreResult | null;
  replay?: RoundReplay;
  pendingCompulsoryKlop?: boolean;
}

const SEATS = [0, 1, 2, 3];
const PHASES = ["bidding", "calling", "talon", "raising", "announcements", "playing", "finished"];
const DECK = new Map(createTarokDeck().map((c) => [cardKey(c), c]));
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) =>
    record(item)
      ? Object.fromEntries(
          Object.keys(item)
            .sort()
            .map((key) => [key, item[key]]),
        )
      : item,
  );
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function integer(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return finite(value) && Number.isSafeInteger(value) && value >= min && value <= max;
}
function seat(value: unknown): value is number {
  return integer(value, 0, 3);
}
function optionalSeat(value: unknown): boolean {
  return value === undefined || seat(value);
}
function text(value: unknown): value is string {
  return typeof value === "string" && value.length <= 200;
}
function numbers(value: unknown, nonnegative = false): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value.every((v) => (nonnegative ? integer(v, 0, 100) : finite(v)))
  );
}
function seats(value: unknown, count?: number): value is number[] {
  return (
    Array.isArray(value) &&
    value.every(seat) &&
    new Set(value).size === value.length &&
    (count === undefined || value.length === count)
  );
}
function card(value: unknown): value is Card {
  if (!record(value)) return false;
  if (value.kind === "tarok") {
    return (
      (value.rank === "skis" || integer(value.rank, 1, 21)) &&
      typeof value.name === "string" &&
      DECK.has(`tarok:${String(value.rank)}:${value.name}`)
    );
  }
  return (
    value.kind === "suit" &&
    typeof value.suit === "string" &&
    typeof value.rank === "string" &&
    DECK.has(`suit:${value.suit}:${value.rank}`)
  );
}
function cards(value: unknown, max = 54): value is Card[] {
  return (
    Array.isArray(value) &&
    value.length <= max &&
    value.every(card) &&
    new Set(value.map(cardKey)).size === value.length
  );
}
function seatRecord(value: unknown, test: (v: unknown) => boolean): boolean {
  return record(value) && Object.keys(value).length === 4 && SEATS.every((pid) => test(value[pid]));
}
function suit(value: unknown): boolean {
  return ["hearts", "diamonds", "clubs", "spades"].includes(String(value));
}
function contract(value: unknown): boolean {
  return value === "klop" || BIDS.includes(value as (typeof BIDS)[number]);
}
function announcement(value: unknown): boolean {
  return ANNOUNCEMENTS.includes(value as (typeof ANNOUNCEMENTS)[number]);
}
function multiplier(value: unknown): boolean {
  return [1, 2, 4, 8, 16].includes(Number(value)) && finite(value);
}

export function isValidSettings(value: unknown): value is GameSettings {
  return (
    record(value) &&
    text(value.humanName) &&
    integer(value.maxRounds, 1, 100) &&
    Array.isArray(value.botConfigs) &&
    value.botConfigs.length === 3 &&
    value.botConfigs.every((b) => record(b) && text(b.name) && integer(b.difficulty, 1, 5))
  );
}

function validTrick(value: unknown, order: readonly number[], complete: boolean): boolean {
  if (!record(value) || !seat(value.leader) || !Array.isArray(value.plays)) return false;
  if (complete ? value.plays.length !== 4 : value.plays.length >= 4) return false;
  const start = order.indexOf(value.leader);
  if (
    !value.plays.every((p, i) => record(p) && p.playerId === order[(start + i) % 4] && card(p.card))
  )
    return false;
  return new Set(value.plays.map((p) => cardKey(p.card))).size === value.plays.length;
}

/** Validate both the shape and the physical-card/phase invariants of a snapshot. */
export function isValidGameState(value: unknown): value is GameState {
  if (
    !record(value) ||
    typeof value.phase !== "string" ||
    !PHASES.includes(value.phase) ||
    !seats(value.playerOrder, 4) ||
    !seat(value.forehand) ||
    !optionalSeat(value.currentPlayer) ||
    !seatRecord(value.hands, (v) => cards(v, 15)) ||
    !cards(value.talon, 6) ||
    value.talon.length !== 6 ||
    !Array.isArray(value.bids) ||
    value.bids.length > 100 ||
    !value.bids.every(
      (b) =>
        record(b) &&
        seat(b.playerId) &&
        (b.action === PASS || BIDS.includes(b.action as (typeof BIDS)[number])),
    ) ||
    !seats(value.passedPlayers) ||
    !optionalSeat(value.declarer) ||
    (value.contract !== undefined && !contract(value.contract)) ||
    !cards(value.discardedCards, 3) ||
    !Array.isArray(value.talonGroups) ||
    value.talonGroups.length > 6 ||
    !value.talonGroups.every((g) => cards(g, 3)) ||
    (value.pickedTalonGroupIndex !== undefined &&
      !integer(value.pickedTalonGroupIndex, 0, value.talonGroups.length - 1)) ||
    !seatRecord(value.radlci, (v) => integer(v, 0, 100)) ||
    typeof value.compulsoryKlop !== "boolean" ||
    typeof value.calledKingInPickedTalon !== "boolean" ||
    typeof value.remainingTalonToDeclarer !== "boolean"
  )
    return false;
  if (
    value.calledKing !== undefined &&
    (!record(value.calledKing) || !suit(value.calledKing.suit) || value.calledKing.rank !== "king")
  )
    return false;
  if (value.teams !== undefined) {
    if (
      !record(value.teams) ||
      !seats(value.teams.declarerTeam) ||
      !seats(value.teams.defendingTeam) ||
      !seats([...value.teams.declarerTeam, ...value.teams.defendingTeam], 4) ||
      !value.teams.declarerTeam.includes(value.declarer as number)
    )
      return false;
  }
  if (
    value.phase !== "bidding" &&
    (!contract(value.contract) ||
      (value.contract !== "klop" &&
        (!seat(value.declarer) || (value.phase !== "calling" && !value.teams))))
  )
    return false;
  if (value.announcementsRound !== undefined) {
    const r = value.announcementsRound;
    if (
      !record(r) ||
      JSON.stringify(r.playerOrder) !== JSON.stringify(value.playerOrder) ||
      r.declarer !== value.declarer ||
      !integer(r.currentPlayerIndex, -1, 3) ||
      !multiplier(r.gameMultiplier) ||
      !optionalSeat(r.gameLastContraBy) ||
      !integer(r.consecutivePasses, 0, 4) ||
      typeof r.isFinished !== "boolean" ||
      !seatRecord(
        r.announcements,
        (v) =>
          Array.isArray(v) &&
          v.length <= 5 &&
          v.every(
            (a) =>
              record(a) &&
              announcement(a.type) &&
              typeof a.isContra === "boolean" &&
              multiplier(a.multiplierLevel) &&
              optionalSeat(a.lastContraBy),
          ) &&
          new Set(v.map((a) => a.type)).size === v.length,
      )
    )
      return false;
    if (
      value.phase === "announcements" &&
      (r.isFinished ||
        value.currentPlayer !==
          getCurrentAnnouncingPlayer(r as unknown as NonNullable<GameState["announcementsRound"]>))
    )
      return false;
  } else if (value.phase === "announcements") return false;
  const groups = value.talonGroups as Card[][];
  const pickedCards =
    value.pickedTalonGroupIndex === undefined ? [] : groups[value.pickedTalonGroupIndex as number]!;
  if (
    groups.length &&
    (groups[0]!.length === 0 ||
      groups.length * groups[0]!.length !== 6 ||
      !groups.every((g) => g.length === groups[0]!.length))
  )
    return false;
  if (
    ["bidding", "calling"].includes(value.phase) &&
    (groups.length || value.discardedCards.length)
  )
    return false;
  if (value.phase === "talon" && (!groups.length || value.discardedCards.length)) return false;
  if (value.phase !== "talon" && value.discardedCards.length !== pickedCards.length) return false;
  if (
    value.phase !== "playing" &&
    value.phase !== "finished" &&
    !SEATS.every(
      (pid) =>
        (value.hands as GameState["hands"])[pid]!.length ===
        12 + (value.phase === "talon" && pid === value.declarer ? pickedCards.length : 0),
    )
  )
    return false;
  const held: Card[] = Object.values(value.hands as GameState["hands"]).flat();
  let played: Card[] = [];
  if (value.trickRound !== undefined) {
    const r = value.trickRound;
    if (
      !record(r) ||
      JSON.stringify(r.playerOrder) !== JSON.stringify(value.playerOrder) ||
      !Array.isArray(r.hands) ||
      r.hands.length !== 4 ||
      !seats(
        r.hands.map((h) => (record(h) ? h.playerId : undefined)),
        4,
      ) ||
      !r.hands.every(
        (h) =>
          cards(h.cards, 12) &&
          JSON.stringify(h.cards) ===
            JSON.stringify((value.hands as GameState["hands"])[h.playerId]),
      ) ||
      !validTrick(r.currentTrick, value.playerOrder, false) ||
      !Array.isArray(r.capturedTricks) ||
      r.capturedTricks.length > 12 ||
      !r.capturedTricks.every(
        (ct) =>
          record(ct) &&
          seat(ct.winner) &&
          validTrick(ct.trick, value.playerOrder as number[], true),
      )
    )
      return false;
    const round = r as unknown as NonNullable<GameState["trickRound"]>;
    played = [
      ...round.capturedTricks.flatMap((ct) => ct.trick.plays.map((p) => p.card)),
      ...round.currentTrick.plays.map((p) => p.card),
    ];
    if (value.phase === "playing" && value.currentPlayer !== getCurrentPlayer(round)) return false;
    if (value.phase !== "playing" && value.phase !== "finished") return false;
  } else if (value.phase === "playing" || value.phase === "finished") return false;
  if (value.phase === "finished" ? value.currentPlayer !== undefined : !seat(value.currentPlayer))
    return false;
  if (
    ["calling", "talon", "raising"].includes(String(value.phase)) &&
    value.currentPlayer !== value.declarer
  )
    return false;
  const picked =
    value.pickedTalonGroupIndex === undefined
      ? []
      : (value.talonGroups[value.pickedTalonGroupIndex as number] as Card[]);
  if (
    value.talonGroups.length &&
    JSON.stringify(value.talonGroups.flat()) !== JSON.stringify(value.talon)
  )
    return false;
  const remainingTalon = value.talon.filter((c) => !picked.some((p) => cardKey(p) === cardKey(c)));
  const physical = [...held, ...played, ...value.discardedCards, ...remainingTalon];
  return physical.length === 54 && new Set(physical.map(cardKey)).size === 54;
}

function teamScore(value: unknown): boolean {
  return (
    record(value) &&
    finite(value.cardPoints) &&
    typeof value.wonTrula === "boolean" &&
    typeof value.wonKings === "boolean" &&
    cards(value.collectedCards)
  );
}
function validScore(value: unknown): value is GameScoreResult {
  return (
    record(value) &&
    teamScore(value.declarerTeam) &&
    teamScore(value.defendingTeam) &&
    cards(value.uncollectedCards) &&
    typeof value.isWin === "boolean" &&
    [
      "razlika",
      "contractValue",
      "bonusValue",
      "mondfang",
      "totalBeforeRadlci",
      "newRadlciEarned",
    ].every((k) => finite(value[k])) &&
    optionalSeat(value.mondfangPlayerId) &&
    Array.isArray(value.bonuses) &&
    value.bonuses.length <= 10 &&
    value.bonuses.every(
      (b) =>
        record(b) &&
        announcement(b.type) &&
        ["declarer", "defenders", "silent"].includes(String(b.announcedBy)) &&
        typeof b.achieved === "boolean" &&
        finite(b.value),
    ) &&
    (value.klopPlayerPoints === undefined || seatRecord(value.klopPlayerPoints, finite)) &&
    (value.klopWinners === undefined || seats(value.klopWinners)) &&
    (value.klopLosers === undefined || seats(value.klopLosers))
  );
}
function validHistory(value: unknown): value is RoundResult[] {
  return (
    Array.isArray(value) &&
    value.length <= 100 &&
    value.every(
      (r) =>
        record(r) &&
        integer(r.round, 1, 100) &&
        contract(r.contract) &&
        text(r.declarer) &&
        numbers(r.perPlayerDelta) &&
        [
          "razlika",
          "valueBeforeRadlci",
          "finalValue",
          "radlciUsed",
          "mondfang",
          "newRadlciEarned",
        ].every((k) => finite(r[k])) &&
        optionalSeat(r.mondfangPlayerId) &&
        ["declarer", "defenders", "klop"].includes(String(r.winnerTeam)),
    )
  );
}
function validAction(value: unknown): value is GameAction {
  if (!record(value) || !seat(value.playerId)) return false;
  switch (value.type) {
    case "bid":
      return value.action === PASS || BIDS.includes(value.action as (typeof BIDS)[number]);
    case "call":
      return value.suit === undefined || suit(value.suit);
    case "talonPick":
      return integer(value.groupIndex, 0, 5);
    case "discard":
      return cards(value.cards, 3);
    case "raise":
      return typeof value.raise === "boolean";
    case "contra":
      return value.target === "game" || announcement(value.target);
    case "announce":
      return announcement(value.announcement);
    case "announcePass":
      return true;
    case "play":
      return card(value.card);
    default:
      return false;
  }
}

/** Unknown/future versions and damaged sessions are rejected, never cast blindly. */
export function parseSession(raw: string | null): PersistedSession | null {
  if (!raw || raw.length > 2_000_000) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !record(parsed) ||
      (parsed.version !== undefined &&
        parsed.version !== 1 &&
        parsed.version !== SESSION_VERSION) ||
      !isValidSettings(parsed.settings) ||
      !integer(parsed.round, 1, parsed.settings.maxRounds)
    )
      return null;
    const state = parsed.state == null ? null : parsed.state;
    // Legacy snapshots predate these booleans; migrate only missing fields.
    if (record(state) && parsed.version !== SESSION_VERSION) {
      if (state.compulsoryKlop === undefined) state.compulsoryKlop = false;
      if (state.calledKingInPickedTalon === undefined) state.calledKingInPickedTalon = false;
      if (state.remainingTalonToDeclarer === undefined) state.remainingTalonToDeclarer = false;
    }
    if (state !== null && !isValidGameState(state)) return null;
    if (
      parsed.score != null &&
      (!validScore(parsed.score) || (state !== null && state.phase !== "finished"))
    )
      return null;
    const history = parsed.hist ?? [];
    const scores = parsed.scores ?? [0, 0, 0, 0];
    const radlci = parsed.radlci ?? [0, 0, 0, 0];
    if (
      !validHistory(history) ||
      !numbers(scores) ||
      !numbers(radlci, true) ||
      new Set(history.map((r) => r.round)).size !== history.length ||
      history.some((r) => r.round > (parsed.round as number))
    )
      return null;
    if (parsed.score != null && state !== null && !history.some((r) => r.round === parsed.round))
      return null;
    if (
      parsed.pendingCompulsoryKlop !== undefined &&
      typeof parsed.pendingCompulsoryKlop !== "boolean"
    )
      return null;
    let replay: RoundReplay | undefined;
    if (parsed.replay !== undefined) {
      const r = parsed.replay;
      if (
        !record(r) ||
        !isValidGameState(r.baseState) ||
        !Array.isArray(r.actions) ||
        r.actions.length > 1024 ||
        !r.actions.every(validAction) ||
        !Array.isArray(r.botRngStates) ||
        r.botRngStates.length !== 3 ||
        !r.botRngStates.every((n) => integer(n, 0, 0xffffffff))
      )
        return null;
      let replayed = r.baseState;
      for (const action of r.actions) replayed = applyAction(replayed, action);
      if (stableJson(replayed) !== stableJson(state)) return null;
      replay = r as unknown as RoundReplay;
    }
    return {
      settings: parsed.settings,
      round: parsed.round,
      history,
      scores,
      radlci,
      seed: integer(parsed.seed, 0, 0xffffffff) ? parsed.seed : null,
      state: state as GameState | null,
      roundScore: (parsed.score as GameScoreResult | null) ?? null,
      ...(replay ? { replay } : {}),
      ...(typeof parsed.pendingCompulsoryKlop === "boolean"
        ? { pendingCompulsoryKlop: parsed.pendingCompulsoryKlop }
        : {}),
    };
  } catch {
    return null;
  }
}

export function serializeSession(session: PersistedSession): string {
  return JSON.stringify({
    version: SESSION_VERSION,
    settings: session.settings,
    round: session.round,
    hist: session.history,
    scores: session.scores,
    radlci: session.radlci,
    seed: session.seed,
    state: session.state,
    score: session.roundScore,
    replay: session.replay,
    pendingCompulsoryKlop: session.pendingCompulsoryKlop,
  });
}
