import type { GameState } from "../state/state.js";
import { type PlayerId, type Bid } from "../bidding/bidding.js";
import type { Card } from "../cards/card.js";
import { countPoints, hasTrula, hasAllKings } from "./scoring.js";
import type { AnnouncementType } from "../announcements/announcements.js";

/**
 * Base game values in radlci (game points) for each contract.
 * Source: Official Slovenian Tarok rules.
 */
export const CONTRACT_VALUES: Record<Bid | "klop", number> = {
  klop:         0,
  tri:          10,
  dve:          20,
  ena:          30,
  solo_tri:     40,
  solo_dve:     50,
  solo_ena:     60,
  berac:        70,
  solo_brez:    80,
  odprti_berac: 90,
  barvni_valat: 125,
  valat:        250,
};

/**
 * Base bonus values in radlci for each announcement type.
 */
export const ANNOUNCEMENT_VALUES: Record<AnnouncementType, number> = {
  trula:        20,
  kralji:       20,
  pagat_ultimo: 50,
  kralj_ultimo: 20,
  valat:        500,
};

export interface BonusResult {
  readonly type: AnnouncementType | "trula_silent" | "kralji_silent";
  readonly announcedBy: "declarer" | "defenders" | "silent"; // silent = unannounced but achieved
  readonly achieved: boolean;
  readonly radlci: number; // net radlci (positive = declarer gains, negative = declarer loses)
}

export interface TeamScoreResult {
  readonly cardPoints: number;
  readonly wonBonuses: {
    readonly trula: boolean;
    readonly kings: boolean;
  };
  readonly collectedCards: readonly Card[];
}

export interface GameScoreResult {
  readonly declarerTeam: TeamScoreResult;
  readonly defendingTeam: TeamScoreResult;
  readonly uncollectedCards: readonly Card[];
  readonly isWin: boolean;
  readonly pointDifference: number;  // card point diff from 35
  readonly contractRadlci: number;   // value of the contract itself
  readonly bonuses: readonly BonusResult[]; // each bonus/announcement
  readonly totalRadlci: number;      // final signed radlci (+ = declarer wins, - = declarer loses)
}

/**
 * Calculates the full Slovenian Tarok score:
 * - card points per team
 * - contract radlci
 * - announced/silent bonuses (trula, kralji, pagat ultimo, valat)
 * - total radlci for the round
 */
export function calculateGameScore(state: GameState): GameScoreResult {
  if (state.phase !== "finished" || !state.trickRound) {
    throw new Error("Cannot score an unfinished game");
  }

  const { teams, discardedCards, trickRound } = state;
  const isKlop = state.contract === "klop";

  if (isKlop) {
    throw new Error("Klop scoring requires a specialized function");
  }

  if (!teams || state.declarer === undefined) {
    throw new Error("Teams must be defined for normal contract scoring");
  }

  // --- 1. Collect cards per player ---
  const playerCollectedCards: Record<PlayerId, Card[]> = {};
  for (const playerId of state.playerOrder) {
    playerCollectedCards[playerId] = [];
  }
  for (const capturedTrick of trickRound.capturedTricks) {
    const cardsInTrick = capturedTrick.trick.plays.map((p) => p.card);
    playerCollectedCards[capturedTrick.winner]?.push(...cardsInTrick);
  }

  // --- 2. Aggregate by team ---
  const declarerCollected: Card[] = [...discardedCards];
  const defendingCollected: Card[] = [];
  for (const playerId of state.playerOrder) {
    const cards = playerCollectedCards[playerId] || [];
    if (teams.declarerTeam.includes(playerId)) {
      declarerCollected.push(...cards);
    } else {
      defendingCollected.push(...cards);
    }
  }

  // Unpicked talon groups go to defenders
  const cardsInPlay = new Set([...declarerCollected, ...defendingCollected].map(c => JSON.stringify(c)));
  const uncollectedCards = state.talon.filter(c => !cardsInPlay.has(JSON.stringify(c)));
  defendingCollected.push(...uncollectedCards);

  // --- 3. Card points ---
  const declarerPoints = countPoints(declarerCollected);
  const defendingPoints = countPoints(defendingCollected);

  const declarerWonTrula = hasTrula(declarerCollected);
  const declarerWonKings = hasAllKings(declarerCollected);
  const defendingWonTrula = hasTrula(defendingCollected);
  const defendingWonKings = hasAllKings(defendingCollected);

  const isWin = declarerPoints > 35;
  const pointDifference = declarerPoints - 35; // negative if lost

  // --- 4. Contract radlci ---
  const contract = state.contract as Bid | "klop";
  const contractBase = CONTRACT_VALUES[contract] ?? 10;
  // Contract doubles if lost (declarer loses the same amount they would have won)
  const contractRadlci = isWin ? contractBase : -contractBase;

  // --- 5. Bonuses (napovedi + tihe napovedi) ---
  const bonuses: BonusResult[] = [];

  // Collect all announcements made by each team
  const announcements = state.announcementsRound?.announcements ?? {};
  const declarerTeamIds = new Set(teams.declarerTeam);

  const announcedByDeclarer = new Set<AnnouncementType>();
  const announcedByDefenders = new Set<AnnouncementType>();

  for (const [pidStr, playerAnns] of Object.entries(announcements)) {
    const pid = Number(pidStr) as PlayerId;
    for (const ann of playerAnns) {
      if (declarerTeamIds.has(pid)) {
        announcedByDeclarer.add(ann.type);
      } else {
        announcedByDefenders.add(ann.type);
      }
    }
  }

  // Helper: evaluate a single bonus
  function evalBonus(
    type: AnnouncementType,
    achievedByDeclarer: boolean,
  ): void {
    const baseValue = ANNOUNCEMENT_VALUES[type];
    const declarerAnnounced = announcedByDeclarer.has(type);
    const defenderAnnounced = announcedByDefenders.has(type);

    if (achievedByDeclarer) {
      // Declarer's team won this bonus
      if (declarerAnnounced) {
        // Announced + achieved = double value
        bonuses.push({ type, announcedBy: "declarer", achieved: true, radlci: baseValue * 2 });
      } else if (defenderAnnounced) {
        // Defenders announced it for declarer's team to miss, but declarer got it anyway
        // Defenders lose their announced bet, declarer gets silent bonus
        bonuses.push({ type, announcedBy: "defenders", achieved: false, radlci: baseValue * 2 });
      } else {
        // Silent (tiho) - achieved without announcement = base value
        bonuses.push({ type, announcedBy: "silent", achieved: true, radlci: baseValue });
      }
    } else {
      // Defenders got this bonus
      if (defenderAnnounced) {
        // Defenders announced it and achieved it = double value against declarer
        bonuses.push({ type, announcedBy: "defenders", achieved: true, radlci: -(baseValue * 2) });
      } else if (declarerAnnounced) {
        // Declarer announced but failed = pay double
        bonuses.push({ type, announcedBy: "declarer", achieved: false, radlci: -(baseValue * 2) });
      } else {
        // Defenders got it silently = base value against declarer
        bonuses.push({ type, announcedBy: "silent", achieved: false, radlci: -baseValue });
      }
    }
  }

  evalBonus("trula", declarerWonTrula);
  evalBonus("kralji", declarerWonKings);
  // pagat_ultimo and kralj_ultimo would need last-trick tracking - skip for now unless announced
  // valat is handled as an announcement if someone announced it
  if (announcedByDeclarer.has("pagat_ultimo") || announcedByDefenders.has("pagat_ultimo")) {
    // Check if Pagat (tarok I) was won in the last trick by the announcer's team
    const lastTrick = trickRound.capturedTricks[trickRound.capturedTricks.length - 1];
    if (lastTrick) {
      const pagatInLastTrick = lastTrick.trick.plays.some(
        p => p.card.kind === "tarok" && p.card.rank === 1
      );
      const pagatWonByDeclarer = pagatInLastTrick && declarerTeamIds.has(lastTrick.winner);
      if (announcedByDeclarer.has("pagat_ultimo") || announcedByDefenders.has("pagat_ultimo")) {
        evalBonus("pagat_ultimo", pagatWonByDeclarer);
      }
    }
  }

  // --- 6. Total radlci ---
  const bonusTotal = bonuses.reduce((sum, b) => sum + b.radlci, 0);
  const totalRadlci = contractRadlci + bonusTotal;

  return {
    declarerTeam: {
      cardPoints: declarerPoints,
      wonBonuses: { trula: declarerWonTrula, kings: declarerWonKings },
      collectedCards: declarerCollected,
    },
    defendingTeam: {
      cardPoints: defendingPoints,
      wonBonuses: { trula: defendingWonTrula, kings: defendingWonKings },
      collectedCards: defendingCollected,
    },
    uncollectedCards,
    isWin,
    pointDifference,
    contractRadlci,
    bonuses,
    totalRadlci,
  };
}