/// <reference types="vite/client" />
import type { Card } from "@tarok/engine";

function assetUrl(filename: string, baseUrl: string): string {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return `${base}cards/faces/${filename}`;
}

/** Public-path face for a card (Industrie und Glück / Modiano Maribor scans). */
export function cardFaceUrl(card: Card, baseUrl = import.meta.env.BASE_URL): string {
  const filename =
    card.kind === "tarok" ? `tarok-${card.rank}.jpg` : `${card.suit}-${card.rank}.jpg`;
  return assetUrl(filename, baseUrl);
}

export function cardBackUrl(baseUrl = import.meta.env.BASE_URL): string {
  return assetUrl("back.jpg", baseUrl);
}

export const CARD_BACK_URL = cardBackUrl();
