import type { Card } from "../cards/card.js";
import { cardKey, isTarokCard } from "../cards/card.js";

/** »Brez taroka ni taroka« — roka mora vsebovati vsaj en tarok. */
export function handHasTarok(hand: readonly Card[]): boolean {
  return hand.some(isTarokCard);
}

export function anyHandMissingTarok(hands: readonly (readonly Card[])[]): boolean {
  return hands.some((hand) => !handHasTarok(hand));
}

export const DEAL_LAYOUTS = {
  4: {
    handSize: 12,
    talonSize: 6,
  },
} as const;

export type SupportedPlayerCount = keyof typeof DEAL_LAYOUTS;

export interface DealConfig {
  /**
   * The public API accepts a player count so additional layouts can be added
   * later. Phase 1 supports only four players and rejects every other count.
   */
  playerCount: number;
}

export interface DealResult {
  hands: readonly (readonly Card[])[];
  talon: readonly Card[];
}

export class UnsupportedPlayerCountError extends Error {
  constructor(playerCount: number) {
    super(`Unsupported player count: ${playerCount}`);
    this.name = "UnsupportedPlayerCountError";
  }
}

export function deal(deck: readonly Card[], config: DealConfig): DealResult {
  const layout = DEAL_LAYOUTS[config.playerCount as SupportedPlayerCount];

  if (layout === undefined) {
    throw new UnsupportedPlayerCountError(config.playerCount);
  }

  const { handSize, talonSize } = layout;
  const expectedCards = config.playerCount * handSize + talonSize;

  if (deck.length !== expectedCards) {
    throw new RangeError(
      `Cannot deal ${config.playerCount} players: expected ${expectedCards} cards, received ${deck.length}`,
    );
  }

  const hands: Card[][] = Array.from({ length: config.playerCount }, () => []);

  for (let index = 0; index < deck.length; index += 1) {
    const card = deck[index];

    if (card === undefined) {
      throw new Error("deal encountered an unexpected empty slot");
    }

    const cardsDealt = index;
    const talonStart = config.playerCount * handSize;

    if (cardsDealt >= talonStart) {
      continue;
    }

    const playerIndex = index % config.playerCount;
    const playerHand = hands[playerIndex];

    if (playerHand === undefined) {
      throw new Error("deal encountered an unexpected player slot");
    }

    playerHand.push(card);
  }

  const talon = deck.slice(config.playerCount * handSize);

  if (talon.length !== talonSize) {
    throw new Error(`Expected talon size ${talonSize}, received ${talon.length}`);
  }

  for (const hand of hands) {
    if (hand.length !== handSize) {
      throw new Error(`Expected hand size ${handSize}, received ${hand.length}`);
    }
  }

  const dealtKeys = [
    ...hands.flatMap((hand) => hand.map(cardKey)),
    ...talon.map(cardKey),
  ];
  const uniqueDealtKeys = new Set(dealtKeys);

  if (uniqueDealtKeys.size !== deck.length) {
    throw new Error("Deal produced duplicate cards");
  }

  return {
    hands,
    talon,
  };
}
