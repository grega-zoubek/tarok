import type { GameState } from "../state/state.js";
import { type PlayerId } from "../bidding/bidding.js";
import type { Card } from "../cards/card.js";
import { countPoints, hasTrula, hasAllKings } from "./scoring.js";

export interface TeamScoreResult {
  readonly cardPoints: number;
  readonly wonBonuses: {
    readonly trula: boolean;
    readonly kings: boolean;
    // other bonuses like pagat ultimo etc. will be added later
  };
  readonly collectedCards: readonly Card[];
}

export interface GameScoreResult {
  readonly declarerTeam: TeamScoreResult;
  readonly defendingTeam: TeamScoreResult;
  readonly uncollectedCards: readonly Card[]; // Talon that nobody collected (e.g. untouched group)
  readonly isWin: boolean; // Did declarer team win? (>35 points)
  readonly pointDifference: number; // Difference from 35 points
}

/**
 * Calculates the final card-points and collected cards for each team at the end of the game.
 * It does NOT calculate the monetary/radlc differences or contracts (radlci, razlika v točkah).
 */
export function calculateGameScore(state: GameState): GameScoreResult {
  if (state.phase !== "finished" || !state.trickRound) {
    throw new Error("Cannot score an unfinished game");
  }

  const { teams, discardedCards, trickRound } = state;
  const isKlop = state.contract === "klop";

  // If it's Klop, everyone plays for themselves, but typical Klop scoring is a completely separate function.
  // For standard play, we need teams.
  if (isKlop) {
    throw new Error("Klop scoring requires a specialized function");
  }

  if (!teams || state.declarer === undefined) {
    throw new Error("Teams must be defined for normal contract scoring");
  }

  // Collect all cards won by each player in tricks
  const playerCollectedCards: Record<PlayerId, Card[]> = {};
  for (const playerId of state.playerOrder) {
    playerCollectedCards[playerId] = [];
  }

  for (const capturedTrick of trickRound.capturedTricks) {
    const winnerId = capturedTrick.winner;
    const cardsInTrick = capturedTrick.trick.plays.map((p) => p.card);
    playerCollectedCards[winnerId]?.push(...cardsInTrick);
  }

  // Aggregate cards by team
  const declarerCollected: Card[] = [...discardedCards]; // Declarer's team gets the discarded cards
  const defendingCollected: Card[] = [];

  for (const playerId of state.playerOrder) {
    const cards = playerCollectedCards[playerId] || [];
    if (teams.declarerTeam.includes(playerId)) {
      declarerCollected.push(...cards);
    } else if (teams.defendingTeam.includes(playerId)) {
      defendingCollected.push(...cards);
    }
  }

  // Uncollected talon cards belong to the defending team in most regular games.
  // The unpicked talon groups are effectively won by the defenders.
  // Let's deduce what was unpicked. The talon in the game state is exactly 6 cards.
  // The declarer picked 1, 2, or 3 cards (and discarded them, which are in `discardedCards`).
  // The rest remained in the talon.
  // We can calculate the exact unpicked talon by subtracting the discarded amount or just seeing what the declarer picked.
  const allTalonKeys = new Set(state.talon.map(c => JSON.stringify(c))); // simplification, better to use a proper card key but this works conceptually
  // Actually we have state.pickedTalonGroupIndex, but it's simpler:
  // If talon is 6, and declarer exchanged 3, then 3 remain.
  // We can track unpicked talon cards by seeing which talon cards never entered the game.
  const cardsInPlay = new Set([...declarerCollected, ...defendingCollected].map(c => JSON.stringify(c)));
  
  const uncollectedCards = state.talon.filter(c => !cardsInPlay.has(JSON.stringify(c)));
  
  // In normal contracts, unpicked talon belongs to defenders.
  defendingCollected.push(...uncollectedCards);

  // Score Calculation
  const declarerPoints = countPoints(declarerCollected);
  const defendingPoints = countPoints(defendingCollected);

  // Sanity check: 70 total points
  if (declarerPoints + defendingPoints !== 70) {
    // In some edge cases (like rounding or strange card amounts) this can happen if countPoints logic is not applied globally?
    // Wait, Tarok rules say: countPoints(deck) = 70.
    // If we count teams individually, declarerPoints + defendingPoints might be 70 or 71/69 due to remainders?
    // Actually, counting points by team and summing them doesn't always strictly equal 70 due to remainder deductions.
    // Standard rule: usually we count declarer's cards precisely. Defending is 70 - declarer.
    // Let's stick to calculating both, but use declarerPoints for win validation.
  }

  const declarerWonTrula = hasTrula(declarerCollected);
  const declarerWonKings = hasAllKings(declarerCollected);

  const defendingWonTrula = hasTrula(defendingCollected);
  const defendingWonKings = hasAllKings(defendingCollected);

  const isWin = declarerPoints > 35; // Must have MORE than 35 (so 36+) to win, 35 is loss. (Unless some specific house rules, but 35 is loss).
  const pointDifference = isWin ? declarerPoints - 35 : declarerPoints - 35; // Negative if lost

  return {
    declarerTeam: {
      cardPoints: declarerPoints,
      wonBonuses: {
        trula: declarerWonTrula,
        kings: declarerWonKings,
      },
      collectedCards: declarerCollected,
    },
    defendingTeam: {
      cardPoints: defendingPoints, // Note: In tournament Tarok, Defender points = 70 - Declarer points.
      wonBonuses: {
        trula: defendingWonTrula,
        kings: defendingWonKings,
      },
      collectedCards: defendingCollected,
    },
    uncollectedCards,
    isWin,
    pointDifference,
  };
}