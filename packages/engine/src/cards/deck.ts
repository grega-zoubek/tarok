import {
  cardKey,
  isSuitCard,
  isTarokCard,
  type Card,
} from "./card.js";
import { SUIT_CATALOG, EXPECTED_SUIT_CATALOG_SIZE } from "./suit-catalog.js";
import { TAROK_CATALOG } from "./tarok-catalog.js";
import { getTrulaCards, TRULA_NAMES } from "./trula.js";

export const EXPECTED_DECK_SIZE = 54;
export const EXPECTED_TAROK_COUNT = 22;
export const EXPECTED_SUIT_COUNT = 32;

export interface DeckValidationResult {
  valid: boolean;
  errors: string[];
}

export function createTarokDeck(): readonly Card[] {
  return [...TAROK_CATALOG, ...SUIT_CATALOG];
}

export function validateDeckCatalog(): DeckValidationResult {
  const errors: string[] = [];

  if (TAROK_CATALOG.length !== EXPECTED_TAROK_COUNT) {
    errors.push(
      `Expected ${EXPECTED_TAROK_COUNT} taroks, found ${TAROK_CATALOG.length}`,
    );
  }

  if (SUIT_CATALOG.length !== EXPECTED_SUIT_CATALOG_SIZE) {
    errors.push(
      `Expected ${EXPECTED_SUIT_CATALOG_SIZE} suit cards, found ${SUIT_CATALOG.length}`,
    );
  }

  const deck = createTarokDeck();

  if (deck.length !== EXPECTED_DECK_SIZE) {
    errors.push(`Expected ${EXPECTED_DECK_SIZE} cards, found ${deck.length}`);
  }

  const taroks = deck.filter(isTarokCard);
  const suits = deck.filter(isSuitCard);

  if (taroks.length !== EXPECTED_TAROK_COUNT) {
    errors.push(
      `Expected ${EXPECTED_TAROK_COUNT} taroks in deck, found ${taroks.length}`,
    );
  }

  if (suits.length !== EXPECTED_SUIT_COUNT) {
    errors.push(
      `Expected ${EXPECTED_SUIT_COUNT} suit cards in deck, found ${suits.length}`,
    );
  }

  const keys = deck.map(cardKey);
  const uniqueKeys = new Set(keys);

  if (uniqueKeys.size !== deck.length) {
    errors.push("Deck contains duplicate cards");
  }

  const pagatCards = taroks.filter((card) => card.name === "pagat");
  if (pagatCards.length !== 1) {
    errors.push(`Expected exactly one Pagat, found ${pagatCards.length}`);
  } else if (pagatCards[0]?.rank !== 1) {
    errors.push("Pagat must be Tarok I (rank 1)");
  }

  const mondCards = taroks.filter((card) => card.name === "mond");
  if (mondCards.length !== 1) {
    errors.push(`Expected exactly one Mond, found ${mondCards.length}`);
  } else if (mondCards[0]?.rank !== 21) {
    errors.push("Mond must be Tarok XXI (rank 21)");
  }

  const skisCards = taroks.filter((card) => card.rank === "skis");
  if (skisCards.length !== 1) {
    errors.push(`Expected exactly one Škis, found ${skisCards.length}`);
  } else if (skisCards[0]?.name !== "skis") {
    errors.push("Škis must use rank 'skis' and name 'skis'");
  }

  if (pagatCards[0] && skisCards[0] && cardKey(pagatCards[0]) === cardKey(skisCards[0])) {
    errors.push("Škis must be distinct from Pagat");
  }

  const trulaCards = getTrulaCards(deck);
  if (trulaCards.length !== TRULA_NAMES.length) {
    errors.push(
      `Expected Trula to contain ${TRULA_NAMES.length} cards, found ${trulaCards.length}`,
    );
  }

  const trulaNames = new Set(trulaCards.map((card) => card.name));
  for (const name of TRULA_NAMES) {
    if (!trulaNames.has(name)) {
      errors.push(`Trula is missing ${name}`);
    }
  }

  for (const tarok of taroks) {
    if (tarok.rank === "skis") {
      continue;
    }

    if (tarok.rank < 1 || tarok.rank > 21) {
      errors.push(`Invalid numbered tarok rank: ${String(tarok.rank)}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
