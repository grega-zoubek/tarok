import type { Card } from "@tarok/engine";

/** Public-path face for a card (Industrie und Glück / Modiano Maribor scans). */
export function cardFaceUrl(card: Card): string {
  if (card.kind === "tarok") {
    if (card.rank === "skis") return "/cards/faces/tarok-skis.jpg";
    return `/cards/faces/tarok-${card.rank}.jpg`;
  }
  return `/cards/faces/${card.suit}-${card.rank}.jpg`;
}

export const CARD_BACK_URL = "/cards/faces/back.jpg";
