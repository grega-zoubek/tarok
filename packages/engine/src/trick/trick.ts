import { cardKey, type Card } from "../cards/card.js";

/**
 * A seat identifier. The game state will define which numeric seats are in
 * use; the engine deliberately does not attach a person or an AI to a seat.
 */
export type PlayerId = number;

export interface PlayedCard {
  readonly playerId: PlayerId;
  readonly card: Card;
}

/**
 * Cards played in one trick, in the order in which they were played.
 * Determining legal plays and the winner is intentionally deferred.
 */
export interface Trick {
  readonly leader: PlayerId;
  readonly plays: readonly PlayedCard[];
}

export function createTrick(leader: PlayerId): Trick {
  return { leader, plays: [] };
}

/**
 * Returns a new trick with a play appended. It preserves the structural
 * invariants that a seat and a physical card can appear only once per trick.
 */
export function addPlay(trick: Trick, play: PlayedCard): Trick {
  if (trick.plays.some((existingPlay) => existingPlay.playerId === play.playerId)) {
    throw new RangeError(`Player ${play.playerId} has already played in this trick`);
  }

  const key = cardKey(play.card);
  if (trick.plays.some((existingPlay) => cardKey(existingPlay.card) === key)) {
    throw new RangeError(`Card ${key} has already been played in this trick`);
  }

  return {
    leader: trick.leader,
    plays: [...trick.plays, play],
  };
}
