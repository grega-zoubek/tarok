import type { SuitCard } from "../cards/card.js";
import type { SuitRankFor, Suit } from "../cards/suit.js";
import { isSuitCard } from "../cards/card.js";
import { type PlayerId } from "../bidding/bidding.js";

export type CalledKing = { suit: Suit; rank: "king" };

export interface CallingRound {
  readonly declarer: PlayerId;
  readonly calledKing: CalledKing | undefined;
  /** True if the calling phase has been completed. */
  readonly isFinished: boolean;
}

export function createCallingRound(declarer: PlayerId): CallingRound {
  return {
    declarer,
    calledKing: undefined,
    isFinished: false,
  };
}

/**
 * Checks if a specific suit card is a King.
 */
export function isKing(card: SuitCard): card is SuitCard & { rank: "king" } {
  return card.rank === "king";
}

/**
 * Validates whether the declarer holds the specified King in their hand.
 */
export function holdsKing(hand: readonly SuitCard[], suit: Suit): boolean {
  return hand.some((card) => card.suit === suit && isKing(card));
}

/**
 * The declarer calls a King. They must not hold all 4 Kings to make a normal call,
 * but in a typical situation, if they hold 3 kings, they can call the 4th.
 * If they hold the king they are calling, they are playing alone (quiet solo).
 */
export function callKing(round: CallingRound, playerId: PlayerId, suit: Suit): CallingRound {
  if (round.isFinished) {
    throw new Error("Calling round is already finished");
  }

  if (round.declarer !== playerId) {
    throw new Error(`Only the declarer (player ${round.declarer}) can call a King`);
  }

  return {
    ...round,
    calledKing: { suit, rank: "king" },
    isFinished: true, // Typically finished right after one call
  };
}

/**
 * In Solo games, or games like Berač / Valat, no king is called.
 * This function skips the calling phase.
 */
export function skipCalling(round: CallingRound, playerId: PlayerId): CallingRound {
  if (round.isFinished) {
    throw new Error("Calling round is already finished");
  }

  if (round.declarer !== playerId) {
    throw new Error(`Only the declarer (player ${round.declarer}) can skip calling`);
  }

  return {
    ...round,
    calledKing: undefined,
    isFinished: true,
  };
}

/**
 * Once the game resolves, we need to know who the partner is.
 * This is determined by looking at the player hands during the trick resolution,
 * but for game state purposes, we can determine teams here based on hands.
 * (Note: The partner is usually unknown to everyone but the partner themselves until the card is played).
 */
export interface Teams {
  readonly declarerTeam: readonly PlayerId[];
  readonly defendingTeam: readonly PlayerId[];
}

/**
 * Determines the teams based on who holds the called King.
 * Includes logic for when the declarer calls their own King (playing alone).
 */
export function determineTeams(
  playerHands: Record<PlayerId, readonly SuitCard[]>,
  declarer: PlayerId,
  calledKing?: CalledKing
): Teams {
  const allPlayers = Object.keys(playerHands).map(Number);
  
  if (!calledKing) {
    // Solo, Klop, Berač, Valat: Declarer vs Everyone else
    return {
      declarerTeam: [declarer],
      defendingTeam: allPlayers.filter((p) => p !== declarer),
    };
  }

  // Find who has the called King
  let partner: PlayerId | undefined = undefined;

  for (const playerId of allPlayers) {
    const hand = playerHands[playerId];
    if (hand && holdsKing(hand, calledKing.suit)) {
      partner = playerId;
      break;
    }
  }

  // It's possible the King is in the Talon. If so, partner remains undefined,
  // meaning the declarer plays alone against the others (the Talon is not a player).
  
  if (partner === undefined || partner === declarer) {
    // King is in talon OR declarer called their own King.
    return {
      declarerTeam: [declarer],
      defendingTeam: allPlayers.filter((p) => p !== declarer),
    };
  }

  return {
    declarerTeam: [declarer, partner].sort((a, b) => a - b),
    defendingTeam: allPlayers.filter((p) => p !== declarer && p !== partner).sort((a, b) => a - b),
  };
}
