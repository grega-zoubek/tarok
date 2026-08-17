import type { TarokCard } from "./card.js";

const SKIS_STRENGTH = 22;

export function tarokStrength(card: TarokCard): number {
  if (card.rank === "skis") {
    return SKIS_STRENGTH;
  }

  return card.rank;
}

export function compareTaroks(a: TarokCard, b: TarokCard): -1 | 0 | 1 {
  const diff = tarokStrength(a) - tarokStrength(b);

  if (diff < 0) {
    return -1;
  }

  if (diff > 0) {
    return 1;
  }

  return 0;
}

export function isHighestTarok(card: TarokCard): boolean {
  return card.rank === "skis";
}

export function isSecondHighestTarok(card: TarokCard): boolean {
  return card.rank === 21 && card.name === "mond";
}

export function isLowestNumberedTarok(card: TarokCard): boolean {
  return card.rank === 1 && card.name === "pagat";
}
