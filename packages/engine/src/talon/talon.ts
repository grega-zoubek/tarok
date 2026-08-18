import { type Card, isTarokCard, cardsEqual, isSuitCard } from "../cards/card.js";
import { type PlayerId } from "../bidding/bidding.js";

export interface TalonExchangeRound {
  readonly declarer: PlayerId;
  readonly talon: readonly Card[];
  readonly exchangeCount: 3 | 2 | 1;
  readonly isFinished: boolean;
  /** Grouped talon subsets visible to the declarer to pick from */
  readonly talonGroups: readonly (readonly Card[])[];
  readonly pickedGroupIndex: number | undefined;
  readonly discardedCards: readonly Card[];
}

export function createTalonExchange(
  declarer: PlayerId,
  talon: readonly Card[],
  exchangeCount: 3 | 2 | 1
): TalonExchangeRound {
  if (talon.length !== 6) {
    throw new Error("Talon must contain exactly 6 cards");
  }

  // Create groups of size `exchangeCount`
  const talonGroups: Card[][] = [];
  for (let i = 0; i < 6; i += exchangeCount) {
    talonGroups.push(talon.slice(i, i + exchangeCount));
  }

  return {
    declarer,
    talon: [...talon],
    exchangeCount,
    isFinished: false,
    talonGroups,
    pickedGroupIndex: undefined,
    discardedCards: [],
  };
}

export function pickTalonGroup(
  round: TalonExchangeRound,
  playerId: PlayerId,
  groupIndex: number
): TalonExchangeRound {
  if (round.isFinished) {
    throw new Error("Talon exchange is already finished");
  }

  if (round.declarer !== playerId) {
    throw new Error(`Only declarer ${round.declarer} can pick a talon group`);
  }

  if (groupIndex < 0 || groupIndex >= round.talonGroups.length) {
    throw new Error(`Invalid talon group index: ${groupIndex}`);
  }

  if (round.pickedGroupIndex !== undefined) {
    throw new Error("Talon group has already been picked");
  }

  return {
    ...round,
    pickedGroupIndex: groupIndex,
  };
}

export function isLegalDiscard(discardedCards: readonly Card[], hand: readonly Card[]): boolean {
  let hasTrulaOrKings = false;
  let hasTaroks = false;

  for (const card of discardedCards) {
    // 5-point cards cannot be discarded (Kings, Trula)
    if (isTarokCard(card) && (card.rank === "skis" || card.rank === 1 || (card.rank === 21 && card.name === "mond"))) {
      hasTrulaOrKings = true;
    } else if (isSuitCard(card) && card.rank === "king") {
      hasTrulaOrKings = true;
    } else if (isTarokCard(card)) {
      hasTaroks = true;
    }

    // Ensure the card being discarded is actually in the hand
    if (!hand.some(h => cardsEqual(h, card))) {
      return false; // Cannot discard a card not in hand
    }
  }

  if (hasTrulaOrKings) {
    return false;
  }

  // A player can only discard Taroks if they have absolutely no other choice
  // i.e., they hold only Taroks, 5-pointers (Kings), or cards they want to keep but must discard to meet count
  if (hasTaroks) {
    const handSuitCards = hand.filter(c => isSuitCard(c) && c.rank !== "king");
    
    // If the player still has discardable suit cards but is trying to discard a tarok, it's illegal.
    // They must exhaust all valid suit cards first.
    // E.g., if exchangeCount is 3, and handSuitCards.length is 2, they MUST discard those 2, and 1 tarok.
    const discardSuitCount = discardedCards.filter(c => isSuitCard(c)).length;
    if (handSuitCards.length > discardSuitCount) {
      return false;
    }
  }

  return true;
}

export function discardCards(
  round: TalonExchangeRound,
  playerId: PlayerId,
  cardsToDiscard: readonly Card[],
  currentHand: readonly Card[] // Current hand must include the previously picked talon cards
): TalonExchangeRound {
  if (round.isFinished) {
    throw new Error("Talon exchange is already finished");
  }

  if (round.declarer !== playerId) {
    throw new Error(`Only declarer ${round.declarer} can discard cards`);
  }

  if (round.pickedGroupIndex === undefined) {
    throw new Error("Must pick a talon group before discarding");
  }

  if (cardsToDiscard.length !== round.exchangeCount) {
    throw new Error(`Must discard exactly ${round.exchangeCount} cards`);
  }

  if (!isLegalDiscard(cardsToDiscard, currentHand)) {
    throw new Error("Illegal discard: Cannot discard 5-point cards or illegal taroks");
  }

  return {
    ...round,
    discardedCards: [...cardsToDiscard],
    isFinished: true,
  };
}
