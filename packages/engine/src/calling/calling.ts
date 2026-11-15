import type { SuitCard } from "../cards/card.js";
import type { Suit } from "../cards/suit.js";
import { type PlayerId } from "../bidding/bidding.js";

export type CalledKing = { suit: Suit; rank: "king" };

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
