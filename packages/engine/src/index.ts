export type { Rng } from "./rng/rng.js";
export { createSeededRng, nextInt } from "./rng/rng.js";

export {
  BLACK_SUIT_RANKS,
  BLACK_SUITS,
  RED_SUIT_RANKS,
  RED_SUITS,
  SUIT_RANKS_BY_SUIT,
  SUITS,
} from "./cards/suit.js";
export type {
  BlackSuit,
  BlackSuitRank,
  RedSuit,
  RedSuitRank,
  Suit,
  SuitRank,
  SuitRankFor,
} from "./cards/suit.js";

export {
  NUMBERED_TAROK_NAMES,
  cardKey,
  cardsEqual,
  isSuitCard,
  isTarokCard,
} from "./cards/card.js";
export type {
  Card,
  NumberedTarokCard,
  NumberedTarokRank,
  SkisTarokCard,
  SuitCard,
  TarokCard,
  TarokName,
} from "./cards/card.js";

export { TAROK_CATALOG } from "./cards/tarok-catalog.js";
export {
  EXPECTED_SUIT_CATALOG_SIZE,
  SUIT_CATALOG,
} from "./cards/suit-catalog.js";

export {
  TRULA_NAMES,
  getTrulaCards,
  isTrula,
  isTrulaTarok,
} from "./cards/trula.js";
export type { TrulaName } from "./cards/trula.js";

export {
  compareTaroks,
  isHighestTarok,
  isLowestNumberedTarok,
  isSecondHighestTarok,
  tarokStrength,
} from "./cards/tarok-order.js";

export {
  EXPECTED_DECK_SIZE,
  EXPECTED_SUIT_COUNT,
  EXPECTED_TAROK_COUNT,
  createTarokDeck,
  validateDeckCatalog,
} from "./cards/deck.js";
export type { DeckValidationResult } from "./cards/deck.js";

export { shuffle } from "./shuffle/shuffle.js";

export {
  DEAL_LAYOUTS,
  UnsupportedPlayerCountError,
  deal,
} from "./deal/deal.js";
export type {
  DealConfig,
  DealResult,
  SupportedPlayerCount,
} from "./deal/deal.js";

export { addPlay, createTrick } from "./trick/trick.js";
export type { PlayedCard, PlayerId, Trick } from "./trick/trick.js";
