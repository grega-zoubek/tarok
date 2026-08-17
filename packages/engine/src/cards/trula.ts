import type { Card, TarokCard } from "./card.js";
import { isTarokCard } from "./card.js";

export const TRULA_NAMES = ["pagat", "mond", "skis"] as const;

export type TrulaName = (typeof TRULA_NAMES)[number];

export function isTrulaTarok(card: TarokCard): card is TarokCard & { name: TrulaName } {
  return card.name === "pagat" || card.name === "mond" || card.name === "skis";
}

export function isTrula(card: Card): boolean {
  return isTarokCard(card) && isTrulaTarok(card);
}

export function getTrulaCards(cards: readonly Card[]): TarokCard[] {
  return cards.filter(isTrula).filter(isTarokCard);
}
