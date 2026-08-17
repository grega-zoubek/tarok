import { cardKey, type Card, type SuitCard, type TarokCard } from "../cards/card.js";
import { isSuitCard, isTarokCard } from "../cards/card.js";
import { compareTaroks } from "../cards/tarok-order.js";
import { suitStrength } from "../cards/suit.js";
import { isTrulaTarok } from "../cards/trula.js";

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

type TarokPlay = PlayedCard & { readonly card: TarokCard };
type SuitPlay = PlayedCard & { readonly card: SuitCard };

function isTarokPlay(play: PlayedCard): play is TarokPlay {
  return isTarokCard(play.card);
}

function isSuitPlay(play: PlayedCard): play is SuitPlay {
  return isSuitCard(play.card);
}

export function createTrick(leader: PlayerId): Trick {
  return { leader, plays: [] };
}

/**
 * Returns a new trick with a play appended. It preserves the structural
 * invariants that a seat and a physical card can appear only once per trick.
 */
export function addPlay(trick: Trick, play: PlayedCard): Trick {
  if (trick.plays.length === 0 && play.playerId !== trick.leader) {
    throw new RangeError(`The first play must be made by leader ${trick.leader}`);
  }

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

/**
 * Returns the winning play according to normal Tarok trick-taking rules.
 * The caller is responsible for supplying a completed trick whose plays were
 * legal; determining legal plays is the next engine concern.
 */
export function getTrickWinner(trick: Trick): PlayedCard {
  const [lead] = trick.plays;
  if (lead === undefined) {
    throw new RangeError("Cannot determine a winner for an empty trick");
  }

  const tarokPlays = trick.plays.filter(isTarokPlay);
  const containsAllTrula =
    tarokPlays.filter((play) => isTrulaTarok(play.card)).length === 3;

  if (containsAllTrula) {
    const pagatPlay = tarokPlays.find(
      (play) => play.card.name === "pagat",
    );

    if (pagatPlay === undefined) {
      throw new Error("A complete Trula must contain Pagat");
    }

    return pagatPlay;
  }

  if (tarokPlays.length > 0) {
    return tarokPlays.reduce((winner, candidate) =>
      compareTaroks(candidate.card, winner.card) > 0 ? candidate : winner,
    );
  }

  if (!isSuitCard(lead.card)) {
    throw new Error("A trick without taroks must be led by a suit card");
  }

  const ledSuit = lead.card.suit;

  return trick.plays
    .filter(isSuitPlay)
    .filter((play) => play.card.suit === ledSuit)
    .reduce((winner, candidate) =>
      suitStrength(candidate.card) > suitStrength(winner.card) ? candidate : winner,
    );
}
