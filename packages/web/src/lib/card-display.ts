import type { Suit } from "@tarok/engine";

export interface SuitDisplay {
  readonly symbol: string;
  readonly name: string;
  readonly color: string;
}

/** Prikaz francoskih barv z imeni, ki jih uporabljajo slovenska pravila. */
export const SUIT_DISPLAY: Record<Suit, SuitDisplay> = {
  hearts: { symbol: "♥", name: "Srca", color: "#dc2626" },
  diamonds: { symbol: "♦", name: "Karo", color: "#dc2626" },
  clubs: { symbol: "♣", name: "Križ", color: "#1f2937" },
  spades: { symbol: "♠", name: "Pik", color: "#1f2937" },
};

export const RANK_DISPLAY: Record<string, string> = {
  king: "K",
  queen: "Q",
  cavalier: "C",
  jack: "J",
  ace: "A",
};

export function suitSymbol(suit: Suit): string {
  return SUIT_DISPLAY[suit].symbol;
}
