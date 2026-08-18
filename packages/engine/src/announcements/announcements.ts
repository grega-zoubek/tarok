import { type PlayerId, type Bid } from "../bidding/bidding.js";

/**
 * Standard announcements (napovedi) in Tarok.
 * Players can announce these before the first trick is played to gain double points if they succeed
 * (but they lose double points if they fail).
 * If unannounced (tiho), they are worth their base points if succeeded.
 */
export const ANNOUNCEMENTS = [
  "trula",
  "kralji",
  "pagat_ultimo",
  "kralj_ultimo",
  "valat",
] as const;

export type AnnouncementType = (typeof ANNOUNCEMENTS)[number];

export interface PlayerAnnouncement {
  readonly type: AnnouncementType;
  readonly isContra: boolean; // Has it been doubled/redoubled by the opposing team?
  // Note: Tarok has Kontra, Rekontra, Subkontra, Mordkontra. 
  // We can track the multiplier level.
  readonly multiplierLevel: number; // 1 = normal, 2 = kontra, 4 = rekontra, 8 = subkontra, 16 = mordkontra
}

export interface AnnouncementsRound {
  readonly playerOrder: readonly PlayerId[];
  readonly declarer: PlayerId;
  readonly currentPlayerIndex: number;
  
  // A record of which player made which announcements
  readonly announcements: Record<PlayerId, readonly PlayerAnnouncement[]>;
  
  // Who has passed their turn consecutively in the announcements round
  readonly consecutivePasses: number;
  
  readonly isFinished: boolean;
}

export function createAnnouncementsRound(
  playerOrder: readonly PlayerId[],
  declarer: PlayerId,
  startingPlayer: PlayerId // Usually forehand or declarer depending on exact variation, but typically forehand starts
): AnnouncementsRound {
  const startingIndex = playerOrder.indexOf(startingPlayer);
  if (startingIndex === -1) {
    throw new Error("Starting player must be in the player order");
  }

  return {
    playerOrder: [...playerOrder],
    declarer,
    currentPlayerIndex: startingIndex,
    announcements: {
      0: [], 1: [], 2: [], 3: []
    },
    consecutivePasses: 0,
    isFinished: false,
  };
}

export function getCurrentAnnouncingPlayer(round: AnnouncementsRound): PlayerId | undefined {
  if (round.isFinished) return undefined;
  return round.playerOrder[round.currentPlayerIndex];
}

export function placeAnnouncement(
  round: AnnouncementsRound,
  playerId: PlayerId,
  announcementType: AnnouncementType
): AnnouncementsRound {
  if (round.isFinished) {
    throw new Error("Announcements round is already finished");
  }

  if (getCurrentAnnouncingPlayer(round) !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn to announce`);
  }

  const currentAnnouncements = round.announcements[playerId] || [];
  
  if (currentAnnouncements.some(a => a.type === announcementType)) {
    throw new Error(`Player ${playerId} has already announced ${announcementType}`);
  }

  const newAnnouncement: PlayerAnnouncement = {
    type: announcementType,
    isContra: false,
    multiplierLevel: 1, // Base multiplier for an explicit announcement
  };

  return {
    ...round,
    announcements: {
      ...round.announcements,
      [playerId]: [...currentAnnouncements, newAnnouncement],
    },
    consecutivePasses: 0, // Reset consecutive passes because an action was taken!
  };
}

export function placeContra(
  round: AnnouncementsRound,
  playerId: PlayerId,
  targetPlayer: PlayerId,
  announcementType: AnnouncementType | "game" // "game" is for calling Kontra on the contract itself
): AnnouncementsRound {
  // Logic for applying a multiplier (Kontra) to an existing announcement or the game itself.
  // Will require tracking game/contract multipliers as well.
  throw new Error("Not implemented yet");
}

export function passAnnouncements(
  round: AnnouncementsRound,
  playerId: PlayerId
): AnnouncementsRound {
  if (round.isFinished) {
    throw new Error("Announcements round is already finished");
  }

  if (getCurrentAnnouncingPlayer(round) !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn to pass`);
  }

  const nextConsecutivePasses = round.consecutivePasses + 1;
  const isFinished = nextConsecutivePasses === 4;

  let nextPlayerIndex = (round.currentPlayerIndex + 1) % 4;

  return {
    ...round,
    consecutivePasses: nextConsecutivePasses,
    isFinished,
    currentPlayerIndex: isFinished ? -1 : nextPlayerIndex,
  };
}
