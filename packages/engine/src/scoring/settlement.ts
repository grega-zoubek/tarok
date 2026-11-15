import type { PlayerId } from "../bidding/bidding.js";
import type { GameState } from "../state/state.js";
import {
  CONTRACT_BASE_VALUES,
  applyRadlci,
  calculateGameScore,
  type GameScoreResult,
} from "./game-scoring.js";

/**
 * Razrešitev obračuna ene igre v točke po igralcih.
 *
 * Pravila (stevec-taroka.si/pravila):
 *  - družabno pisanje: vrednost igre (in bonusov) vpišejo samo člani aktivne
 *    ekipe (deklarant in partner) — v plus ob zmagi, v minus ob porazu;
 *    branilci ne pišejo ničesar;
 *  - klop: kdor ni pobral nobenega štiha, piše +70; kdor je pobral več kot
 *    35 točk, piše −70; sicer piše minus svoje točke;
 *  - radlci: uporabijo se le radlci AKTIVNEGA igralca (deklaranta) in
 *    podvojijo vrednost igre vsem članom aktivne ekipe; ob zmagi se
 *    izbrišejo le deklarantu (partnerjevi ostanejo). Pri klopu vsak igralec
 *    podvoji svoje točke s svojimi radlci;
 *  - mondfang (−21) se prišteje samo igralcu, ki je izgubil monda, in se
 *    NE podvaja z radlci.
 */
export interface SettlementOptions {
  /** Trenutni radlci po igralcu pred obračunom (privzeto 0). */
  readonly radlci?: Readonly<Record<PlayerId, number>>;
  /** Vrednost, ki jo zmagovalec klopa vpiše v dobro (privzeto 70). */
  readonly klopWinnerValue?: number;
  /** Vrednost, ki jo poraženec klopa (> 35 točk) vpiše v minus (privzeto 70). */
  readonly klopLoserValue?: number;
}

export type SettlementRole =
  | "declarer"
  | "partner"
  | "defender"
  | "klop-winner"
  | "klop-loser"
  | "klop-neutral";

export interface PlayerSettlement {
  readonly playerId: PlayerId;
  readonly role: SettlementRole;
  readonly delta: number;
  readonly radlciBefore: number;
  readonly radlciAfter: number;
  /** Koliko lastnih radlcev je podvojilo ta obračun (klop: po igralcu). */
  readonly radlciUsed: number;
}

export interface GameSettlement {
  readonly score: GameScoreResult;
  /** Vrednost igre iz perspektive aktivne ekipe (0 pri klopu). */
  readonly finalValue: number;
  /** Radlci, ki so podvojili vrednost aktivne ekipe (0 pri klopu). */
  readonly radlciUsed: number;
  readonly perPlayerDelta: Readonly<Record<PlayerId, number>>;
  readonly radlciAfter: Readonly<Record<PlayerId, number>>;
  readonly players: readonly PlayerSettlement[];
}

/**
 * Izračuna končne točke po igralcih in novo stanje radlcev.
 * Kliče se šele, ko je igra v fazi "finished".
 */
export function settleGame(
  state: GameState,
  options: SettlementOptions = {},
): GameSettlement {
  const score = calculateGameScore(state);

  const radlciBefore: Record<PlayerId, number> = {};
  for (const playerId of state.playerOrder) {
    const value = options.radlci?.[playerId] ?? 0;
    radlciBefore[playerId] = Math.max(0, Math.trunc(value));
  }

  const perPlayerDelta: Record<PlayerId, number> = {};
  const radlciAfter: Record<PlayerId, number> = { ...radlciBefore };
  const players: PlayerSettlement[] = [];

  let finalValue = 0;
  let radlciUsed = 0;

  if (state.contract === "klop") {
    const winnerValue = options.klopWinnerValue ?? CONTRACT_BASE_VALUES.klop;
    const loserValue = options.klopLoserValue ?? CONTRACT_BASE_VALUES.klop;
    const winners = new Set(score.klopWinners ?? []);
    const losers = new Set(score.klopLosers ?? []);
    const points = score.klopPlayerPoints ?? {};

    for (const playerId of state.playerOrder) {
      const before = radlciBefore[playerId]!;
      let base: number;
      let role: SettlementRole;

      if (winners.has(playerId)) {
        base = winnerValue;
        role = "klop-winner";
      } else if (losers.has(playerId)) {
        base = -loserValue;
        role = "klop-loser";
      } else {
        base = -(points[playerId] ?? 0);
        role = "klop-neutral";
      }

      const used = before;
      const delta = base * Math.pow(2, used);
      perPlayerDelta[playerId] = delta;

      // Vsak igralec po klopu dobi nov radlc; zmagovalcu se radlc izbriše.
      let after = before + score.newRadlciEarned;
      if (winners.has(playerId)) after = 0;
      radlciAfter[playerId] = after;

      players.push({
        playerId,
        role,
        delta,
        radlciBefore: before,
        radlciAfter: after,
        radlciUsed: used,
      });
    }
  } else {
    const declarerTeam =
      state.teams?.declarerTeam ??
      (state.declarer !== undefined ? [state.declarer] : []);
    const declarerTeamIds = new Set(declarerTeam);

    // Pravilo: uporabijo se radlci aktivnega igralca (ne partnerjevi).
    const declarerRadlciCount =
      state.declarer !== undefined ? (radlciBefore[state.declarer] ?? 0) : 0;
    const applied = applyRadlci(score.totalBeforeRadlci, declarerRadlciCount);
    finalValue = applied.finalValue;
    radlciUsed = applied.radlciUsed;
    // Piše samo aktivna ekipa; branilci ostanejo pri 0.
    const activeDelta = finalValue;
    const defendingDelta = 0;

    for (const playerId of state.playerOrder) {
      const before = radlciBefore[playerId]!;
      const isActiveTeam = declarerTeamIds.has(playerId);
      const delta = isActiveTeam ? activeDelta : defendingDelta;
      perPlayerDelta[playerId] = delta;

      let after = before + score.newRadlciEarned;
      // Deklarant ob zmagi "porabi" svoje radlce; ob porazu jih obdrži.
      // Partnerjevi radlci se ne uporabijo in ostanejo nedotaknjeni.
      if (playerId === state.declarer && score.isWin && radlciUsed > 0) after = 0;
      radlciAfter[playerId] = after;

      const role: SettlementRole =
        playerId === state.declarer
          ? "declarer"
          : isActiveTeam
            ? "partner"
            : "defender";

      players.push({
        playerId,
        role,
        delta,
        radlciBefore: before,
        radlciAfter: after,
        radlciUsed: role === "declarer" ? radlciUsed : 0,
      });
    }

    if (score.mondfang < 0 && score.mondfangPlayerId !== undefined) {
      const loser = score.mondfangPlayerId;
      if (perPlayerDelta[loser] !== undefined) {
        perPlayerDelta[loser] += score.mondfang;
        const entry = players.find((p) => p.playerId === loser);
        if (entry !== undefined) {
          const index = players.indexOf(entry);
          players[index] = { ...entry, delta: entry.delta + score.mondfang };
        }
      }
    }
  }

  return {
    score,
    finalValue,
    radlciUsed,
    perPlayerDelta,
    radlciAfter,
    players,
  };
}
