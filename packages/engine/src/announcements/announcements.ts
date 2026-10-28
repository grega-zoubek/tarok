import { type PlayerId } from "../bidding/bidding.js";

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

/** Cilj kontre: pogodba ali posamezna napoved. */
export type ContraTarget = AnnouncementType | "game";

export interface PlayerAnnouncement {
  readonly type: AnnouncementType;
  readonly isContra: boolean;
  /** 1 = napoved, 2 = kontra, 4 = rekontra, 8 = subkontra, 16 = mordkontra */
  readonly multiplierLevel: number;
  /** Kdo je nazadnje dvignil množitelj (za menjavo strani). */
  readonly lastContraBy: PlayerId | undefined;
}

export interface AnnouncementsRound {
  readonly playerOrder: readonly PlayerId[];
  readonly declarer: PlayerId;
  readonly currentPlayerIndex: number;

  readonly announcements: Record<PlayerId, readonly PlayerAnnouncement[]>;

  /** Množitelj na pogodbo (1, 2, 4, 8, 16). */
  readonly gameMultiplier: number;
  readonly gameLastContraBy: PlayerId | undefined;

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
      0: [], 1: [], 2: [], 3: [],
    },
    gameMultiplier: 1,
    gameLastContraBy: undefined,
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
    multiplierLevel: 1,
    lastContraBy: undefined,
  };

  return {
    ...round,
    announcements: {
      ...round.announcements,
      [playerId]: [...currentAnnouncements, newAnnouncement],
    },
    consecutivePasses: 0,
  };
}

const MAX_CONTRA_LEVEL = 16;

/**
 * Ali sme igralec kontrirati cilj: mora biti na nasprotni strani od zadnjega,
 * ki je nastavil množitelj (ali od deklaranta / napovedovalca pri prvi kontri).
 */
export function canPlaceContra(
  round: AnnouncementsRound,
  playerId: PlayerId,
  target: ContraTarget,
  declarerTeam: readonly PlayerId[],
): boolean {
  if (round.isFinished || getCurrentAnnouncingPlayer(round) !== playerId) {
    return false;
  }

  const onDeclarerTeam = declarerTeam.includes(playerId);

  if (target === "game") {
    if (round.gameMultiplier >= MAX_CONTRA_LEVEL) return false;
    if (round.gameMultiplier === 1) {
      // Prva kontra: samo branilci
      return !onDeclarerTeam;
    }
    const last = round.gameLastContraBy;
    if (last === undefined) return !onDeclarerTeam;
    const lastOnDeclarer = declarerTeam.includes(last);
    return onDeclarerTeam !== lastOnDeclarer;
  }

  // Najdi napoved tega tipa
  let found: PlayerAnnouncement | undefined;
  let announcer: PlayerId | undefined;
  for (const pid of round.playerOrder) {
    const ann = (round.announcements[pid] ?? []).find((a) => a.type === target);
    if (ann) {
      found = ann;
      announcer = pid;
      break;
    }
  }
  if (!found || announcer === undefined) return false;
  if (found.multiplierLevel >= MAX_CONTRA_LEVEL) return false;

  if (found.multiplierLevel === 1) {
    // Prva kontra na napoved: nasprotna ekipa napovedovalca
    const announcerOnDeclarer = declarerTeam.includes(announcer);
    return onDeclarerTeam !== announcerOnDeclarer;
  }

  const last = found.lastContraBy;
  if (last === undefined) {
    const announcerOnDeclarer = declarerTeam.includes(announcer);
    return onDeclarerTeam !== announcerOnDeclarer;
  }
  const lastOnDeclarer = declarerTeam.includes(last);
  return onDeclarerTeam !== lastOnDeclarer;
}

/**
 * Kontra / rekontra / sub / mord na pogodbo ali napoved.
 * Vsak korak podvoji množitelj (do 16).
 */
export function placeContra(
  round: AnnouncementsRound,
  playerId: PlayerId,
  target: ContraTarget,
  declarerTeam: readonly PlayerId[],
): AnnouncementsRound {
  if (!canPlaceContra(round, playerId, target, declarerTeam)) {
    throw new Error(`Igralec ${playerId} ne more kontrirati cilja ${target}`);
  }

  if (target === "game") {
    return {
      ...round,
      gameMultiplier: round.gameMultiplier * 2,
      gameLastContraBy: playerId,
      consecutivePasses: 0,
    };
  }

  const nextAnnouncements: Record<PlayerId, readonly PlayerAnnouncement[]> = {
    ...round.announcements,
  };

  for (const pid of round.playerOrder) {
    const list = nextAnnouncements[pid] ?? [];
    const idx = list.findIndex((a) => a.type === target);
    if (idx === -1) continue;
    const current = list[idx]!;
    nextAnnouncements[pid] = [
      ...list.slice(0, idx),
      {
        ...current,
        isContra: true,
        multiplierLevel: current.multiplierLevel * 2,
        lastContraBy: playerId,
      },
      ...list.slice(idx + 1),
    ];
    break;
  }

  return {
    ...round,
    announcements: nextAnnouncements,
    consecutivePasses: 0,
  };
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
