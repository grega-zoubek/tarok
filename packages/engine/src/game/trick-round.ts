import { cardKey, type Card } from "../cards/card.js";
import {
  addPlay,
  createTrick,
  getTrickWinner,
  playCard,
  getKlopLegalPlays,
  type PlayedCard,
  type PlayerId,
  type Trick,
} from "../trick/trick.js";

export interface PlayerHand {
  readonly playerId: PlayerId;
  readonly cards: readonly Card[];
}

/** State needed to play a single trick, without contracts or scoring. */
export interface TrickRound {
  /** Players in their actual order of play, starting at any fixed seat. */
  readonly playerOrder: readonly PlayerId[];
  readonly hands: readonly PlayerHand[];
  readonly currentTrick: Trick;
  readonly capturedTricks: readonly CapturedTrick[];
}

export interface ResolvedTrick {
  readonly trick: Trick;
  readonly winner: PlayerId;
}

/** A resolved trick retained for later card-point and bonus calculation. */
export interface CapturedTrick extends ResolvedTrick {}

export interface TrickRoundConfig {
  readonly playerOrder: readonly PlayerId[];
  readonly hands: readonly PlayerHand[];
  readonly leader: PlayerId;
}

export function createTrickRound(config: TrickRoundConfig): TrickRound {
  validateRoundConfig(config);

  return {
    playerOrder: [...config.playerOrder],
    hands: config.hands.map((hand) => ({
      playerId: hand.playerId,
      cards: [...hand.cards],
    })),
    currentTrick: createTrick(config.leader),
    capturedTricks: [],
  };
}

export function getCurrentPlayer(round: TrickRound): PlayerId | undefined {
  const { playerOrder, currentTrick } = round;
  if (currentTrick.plays.length >= playerOrder.length) {
    return undefined;
  }

  const leaderIndex = playerOrder.indexOf(currentTrick.leader);
  if (leaderIndex === -1) {
    throw new Error(`Leader ${currentTrick.leader} is not in the player order`);
  }

  return playerOrder[(leaderIndex + currentTrick.plays.length) % playerOrder.length];
}

export function playTurn(
  round: TrickRound,
  playerId: PlayerId,
  card: Card,
): TrickRound {
  const currentPlayer = getCurrentPlayer(round);
  if (currentPlayer === undefined) {
    throw new RangeError("Cannot play a card: the trick is complete");
  }

  if (playerId !== currentPlayer) {
    throw new RangeError(`It is player ${currentPlayer}'s turn, not player ${playerId}'s`);
  }

  const hand = round.hands.find((candidate) => candidate.playerId === playerId);
  if (hand === undefined) {
    throw new Error(`No hand exists for player ${playerId}`);
  }

  const nextTrick = playCard(hand.cards, round.currentTrick, { playerId, card });
  const key = cardKey(card);

  return {
    ...round,
    hands: round.hands.map((candidate) =>
      candidate.playerId === playerId
        ? {
            playerId: candidate.playerId,
            cards: candidate.cards.filter((handCard) => cardKey(handCard) !== key),
          }
        : candidate,
    ),
    currentTrick: nextTrick,
  };
}

export function isTrickComplete(round: TrickRound): boolean {
  return round.currentTrick.plays.length === round.playerOrder.length;
}

export function resolveTrick(round: TrickRound): ResolvedTrick {
  if (!isTrickComplete(round)) {
    throw new RangeError("Cannot resolve an incomplete trick");
  }

  const winningPlay = getTrickWinner(round.currentTrick);
  return { trick: round.currentTrick, winner: winningPlay.playerId };
}

export function getCapturedTricks(
  round: TrickRound,
  playerId: PlayerId,
): CapturedTrick[] {
  return round.capturedTricks.filter((captured) => captured.winner === playerId);
}

/**
 * Klop varianta playTurn — uporablja getKlopLegalPlays (moraš iti čez).
 */
export function playTurnKlop(
  round: TrickRound,
  playerId: PlayerId,
  card: Card,
): TrickRound {
  const currentPlayer = getCurrentPlayer(round);
  if (currentPlayer === undefined) {
    throw new RangeError("Cannot play a card: the trick is complete");
  }
  if (playerId !== currentPlayer) {
    throw new RangeError(`It is player ${currentPlayer}'s turn, not player ${playerId}'s`);
  }
  const hand = round.hands.find((h) => h.playerId === playerId);
  if (hand === undefined) {
    throw new Error(`No hand exists for player ${playerId}`);
  }

  const legalCards = getKlopLegalPlays(hand.cards, round.currentTrick);
  const key = cardKey(card);
  if (!legalCards.some(c => cardKey(c) === key)) {
    throw new RangeError(`Klop: player ${playerId} cannot legally play ${key}`);
  }

  const nextTrick = addPlay(round.currentTrick, { playerId, card });

  return {
    ...round,
    hands: round.hands.map((h) =>
      h.playerId === playerId
        ? { playerId: h.playerId, cards: h.cards.filter(c => cardKey(c) !== key) }
        : h
    ),
    currentTrick: nextTrick,
  };
}

/** Starts the next trick with the winner of the completed current trick. */
export function beginNextTrick(round: TrickRound): TrickRound {
  const resolvedTrick = resolveTrick(round);

  return {
    ...round,
    capturedTricks: [...round.capturedTricks, resolvedTrick],
    currentTrick: createTrick(resolvedTrick.winner),
  };
}

function validateRoundConfig(config: TrickRoundConfig): void {
  if (config.playerOrder.length === 0) {
    throw new RangeError("A trick round needs at least one player");
  }

  const players = new Set(config.playerOrder);
  if (players.size !== config.playerOrder.length) {
    throw new RangeError("The player order contains duplicate player IDs");
  }

  if (!players.has(config.leader)) {
    throw new RangeError(`Leader ${config.leader} is not in the player order`);
  }

  const handPlayers = new Set(config.hands.map((hand) => hand.playerId));
  if (handPlayers.size !== config.hands.length || handPlayers.size !== players.size) {
    throw new RangeError("Exactly one hand is required for every player");
  }

  for (const playerId of players) {
    if (!handPlayers.has(playerId)) {
      throw new RangeError(`No hand exists for player ${playerId}`);
    }
  }
}
