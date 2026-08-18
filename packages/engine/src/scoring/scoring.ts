import { type Card } from "../cards/card.js";
import { isTarokCard, isSuitCard } from "../cards/card.js";

/**
 * Returns the raw point value of a single card according to standard Slovenian Tarok rules:
 * - Trula (Škis, Mond, Pagat) and Kings: 5 points
 * - Queens: 4 points
 * - Cavaliers: 3 points
 * - Jacks: 2 points
 * - Empty cards (platelci - Taroks II-XX and all pip cards): 1 point
 */
export function getCardValue(card: Card): number {
  if (isTarokCard(card)) {
    if (card.rank === "skis" || (card.rank === 21 && card.name === "mond") || (card.rank === 1 && card.name === "pagat")) {
      return 5;
    }
    return 1;
  }

  if (isSuitCard(card)) {
    switch (card.rank) {
      case "king": return 5;
      case "queen": return 4;
      case "cavalier": return 3;
      case "jack": return 2;
      default: return 1;
    }
  }
  
  return 1;
}

/**
 * Calculates the total points from an array of cards using the standard counting method.
 * In Tarok, cards are counted in groups of 3. Each group's value is the sum of the cards minus 2.
 * 
 * Specifically:
 * - 3 cards: sum(values) - 2
 * - 2 cards: sum(values) - 1
 * - 1 card: sum(values) - 1
 * 
 * The total points for the entire 54-card deck must be exactly 70.
 */
export function countPoints(cards: readonly Card[]): number {
  const totalRawValue = cards.reduce((sum, card) => sum + getCardValue(card), 0);
  
  // Every group of 3 cards has 2 points subtracted from its raw sum.
  // The remainder (1 or 2 cards) has 1 point subtracted.
  const groupsOfThree = Math.floor(cards.length / 3);
  const remainder = cards.length % 3;
  
  const deductions = (groupsOfThree * 2) + (remainder > 0 ? 1 : 0);
  
  return totalRawValue - deductions;
}

/**
 * Checks if the provided cards contain all three Trula cards (Škis, Mond, Pagat).
 */
export function hasTrula(cards: readonly Card[]): boolean {
  let hasSkis = false;
  let hasMond = false;
  let hasPagat = false;

  for (const card of cards) {
    if (isTarokCard(card)) {
      if (card.rank === "skis") hasSkis = true;
      else if (card.rank === 21 && card.name === "mond") hasMond = true;
      else if (card.rank === 1 && card.name === "pagat") hasPagat = true;
    }
  }

  return hasSkis && hasMond && hasPagat;
}

/**
 * Checks if the provided cards contain all four Kings.
 */
export function hasAllKings(cards: readonly Card[]): boolean {
  let kingsCount = 0;
  
  for (const card of cards) {
    if (isSuitCard(card) && card.rank === "king") {
      kingsCount++;
    }
  }

  return kingsCount === 4;
}
