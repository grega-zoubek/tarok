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

/**
 * Returns the cards a player may play in a normal positive Tarok contract.
 * Negative contracts and their forced-overtrumping rules are intentionally
 * modelled separately when those contracts are introduced.
 */
export function getLegalPlays(hand: readonly Card[], trick: Trick): Card[] {
  const [lead] = trick.plays;
  if (lead === undefined) {
    return [...hand];
  }

  if (isTarokCard(lead.card)) {
    const taroks = hand.filter(isTarokCard);
    return taroks.length > 0 ? taroks : [...hand];
  }

  const ledSuit = lead.card.suit;
  const matchingSuit = hand.filter(
    (card): card is SuitCard =>
      isSuitCard(card) && card.suit === ledSuit,
  );
  if (matchingSuit.length > 0) {
    return matchingSuit;
  }

  const taroks = hand.filter(isTarokCard);
  return taroks.length > 0 ? taroks : [...hand];
}

/**
 * Pagat mora ostati za zadnjo karto (klop / berač / napovedani pagat ultimo).
 * Če je edina legalna ali zadnja v roki, je dovoljen.
 */
export function holdPagatUntilLast(
  hand: readonly Card[],
  legal: readonly Card[],
): Card[] {
  if (hand.length <= 1) return [...legal];
  const withoutPagat = legal.filter(
    (c) => !(isTarokCard(c) && c.rank === 1),
  );
  return withoutPagat.length > 0 ? withoutPagat : [...legal];
}

/**
 * Klop: poleg sledenja barvi moraš igrati VIŠJO karto, če jo imaš.
 * Če ne mreš iti čez, moraš vseeno slediti barvi (katerakoli karta te barve).
 * Enako za taroke — moraš iti čez vodilni tarok, če ga imaš.
 * Pagat se sme igrati šele kot zadnja karta.
 */
export function getKlopLegalPlays(hand: readonly Card[], trick: Trick): Card[] {
  const [lead] = trick.plays;
  let legal: Card[];
  if (lead === undefined) {
    // Vodja štiha — vsaka karta je legalna (razen pagat-hold spodaj)
    legal = [...hand];
  } else if (isTarokCard(lead.card)) {
    const taroks = hand.filter(isTarokCard);
    if (taroks.length === 0) {
      legal = [...hand];
    } else {
      // Najvišji tarok na mizi
      const highestTarokOnTable = trick.plays
        .filter((p): p is TarokPlay => isTarokCard(p.card))
        .reduce((best, p) =>
          compareTaroks(p.card, best.card) > 0 ? p : best
        );
      const higher = taroks.filter(c => compareTaroks(c, highestTarokOnTable.card) > 0);
      legal = higher.length > 0 ? higher : taroks;
    }
  } else {
    // Vodilna karta je barvna
    const ledSuit = (lead.card as SuitCard).suit;
    const matchingSuit = hand.filter(
      (c): c is SuitCard => isSuitCard(c) && c.suit === ledSuit
    );

    if (matchingSuit.length > 0) {
      // Najvišja karta te barve na mizi
      const highestSuitOnTable = trick.plays
        .filter((p): p is SuitPlay => isSuitPlay(p) && (p.card as SuitCard).suit === ledSuit)
        .reduce((best, p) =>
          suitStrength(p.card as SuitCard) > suitStrength(best.card as SuitCard) ? p : best
        );
      const higher = matchingSuit.filter(
        c => suitStrength(c) > suitStrength(highestSuitOnTable.card as SuitCard)
      );
      legal = higher.length > 0 ? higher : matchingSuit;
    } else {
      // Ni barve — igraj tarok (prav tako moraš iti čez če mreš)
      const taroks = hand.filter(isTarokCard);
      if (taroks.length === 0) {
        legal = [...hand];
      } else {
        const tarokPlaysOnTable = trick.plays.filter((p): p is TarokPlay => isTarokCard(p.card));
        if (tarokPlaysOnTable.length === 0) {
          legal = taroks;
        } else {
          const highestTarokOnTable = tarokPlaysOnTable.reduce((best, p) =>
            compareTaroks(p.card, best.card) > 0 ? p : best
          );
          const higher = taroks.filter(c => compareTaroks(c, highestTarokOnTable.card) > 0);
          legal = higher.length > 0 ? higher : taroks;
        }
      }
    }
  }

  return holdPagatUntilLast(hand, legal);
}

/**
 * Barvni valat: enaka pravila sledenja kot navadna igra, a vodja štiha
 * (deklarant) ne sme voditi s tarokom, dokler ima še barvne karte.
 */
export function getBarvniValatLegalPlays(hand: readonly Card[], trick: Trick): Card[] {
  const [lead] = trick.plays;
  if (lead === undefined) {
    const suitCards = hand.filter(isSuitCard);
    return suitCards.length > 0 ? suitCards : [...hand];
  }
  return getLegalPlays(hand, trick);
}

/**
 * Barvni valat: taroki NISO aduti.
 * - Če je vodilna barvna karta, zmaga najvišja karta te barve (tarok = odvržek).
 * - Če je vodilni tarok, zmaga najvišji tarok (barvne = odvržek).
 * Cesarski štih (pagat vzame trulo) se ne uporablja.
 */
export function getBarvniValatTrickWinner(trick: Trick): PlayedCard {
  const [lead] = trick.plays;
  if (lead === undefined) {
    throw new RangeError("Cannot determine a winner for an empty trick");
  }

  if (isSuitCard(lead.card)) {
    const ledSuit = lead.card.suit;
    const suitPlays = trick.plays
      .filter(isSuitPlay)
      .filter((play) => play.card.suit === ledSuit);
    if (suitPlays.length === 0) {
      throw new Error("A suit-led colour-valat trick must contain the lead suit");
    }
    return suitPlays.reduce((winner, candidate) =>
      suitStrength(candidate.card) > suitStrength(winner.card) ? candidate : winner,
    );
  }

  const tarokPlays = trick.plays.filter(isTarokPlay);
  if (tarokPlays.length === 0) {
    throw new Error("A tarok-led colour-valat trick must contain a tarok");
  }
  return tarokPlays.reduce((winner, candidate) =>
    compareTaroks(candidate.card, winner.card) > 0 ? candidate : winner,
  );
}

export function isLegalPlay(
  hand: readonly Card[],
  trick: Trick,
  card: Card,
): boolean {
  const key = cardKey(card);
  return (
    hand.some((handCard) => cardKey(handCard) === key) &&
    getLegalPlays(hand, trick).some((legalCard) => cardKey(legalCard) === key)
  );
}

/**
 * Adds a card to a trick only when it is held and legal to play. Hand updates
 * belong to the game-state layer, which will be introduced separately.
 */
export function playCard(
  hand: readonly Card[],
  trick: Trick,
  play: PlayedCard,
): Trick {
  if (!isLegalPlay(hand, trick, play.card)) {
    throw new RangeError(`Player ${play.playerId} cannot legally play ${cardKey(play.card)}`);
  }

  return addPlay(trick, play);
}
