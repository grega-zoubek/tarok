export type { Rng, StatefulRng } from "./rng/rng.js";
export { createSeededRng, nextInt } from "./rng/rng.js";

export {
  BLACK_SUIT_RANKS,
  BLACK_SUITS,
  RED_SUIT_RANKS,
  RED_SUITS,
  SUIT_RANKS_BY_SUIT,
  SUITS,
  suitStrength,
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
export { EXPECTED_SUIT_CATALOG_SIZE, SUIT_CATALOG } from "./cards/suit-catalog.js";

export { TRULA_NAMES, getTrulaCards, isTrula, isTrulaTarok } from "./cards/trula.js";
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
  handHasTarok,
  anyHandMissingTarok,
} from "./deal/deal.js";
export type { DealConfig, DealResult, SupportedPlayerCount } from "./deal/deal.js";

export {
  addPlay,
  createTrick,
  getLegalPlays,
  getKlopLegalPlays,
  getBarvniValatLegalPlays,
  getBarvniValatTrickWinner,
  getTrickWinner,
  isLegalPlay,
  playCard,
  holdPagatUntilLast,
} from "./trick/trick.js";
export type { PlayedCard, PlayerId, Trick } from "./trick/trick.js";

export {
  beginNextTrick,
  createTrickRound,
  getCapturedTricks,
  getCurrentPlayer,
  isTrickComplete,
  playTurn,
  resolveTrick,
} from "./game/trick-round.js";
export type {
  CapturedTrick,
  PlayerHand,
  ResolvedTrick,
  TrickRound,
  TrickRoundConfig,
  TrickWinnerFn,
} from "./game/trick-round.js";
export { getCardValue, countPoints, hasTrula, hasAllKings } from "./scoring/scoring.js";
export {
  BIDS,
  PASS,
  createBiddingRound,
  getCurrentBiddingPlayer,
  getLegalBids,
  isLegalBid,
  placeBid,
  resolveBidding,
  getBidPriority,
  COMPULSORY_KLOP_MIN_BID,
  SOLO_RAISABLE_TO_BARVNI,
  isBidAllowedInCompulsoryKlop,
} from "./bidding/bidding.js";
export type {
  Bid,
  Pass,
  BiddingAction,
  BiddingRound,
  BiddingRoundConfig,
  BiddingResult,
} from "./bidding/bidding.js";
export { isKing, holdsKing, determineTeams } from "./calling/calling.js";
export type { CalledKing, Teams } from "./calling/calling.js";
export {
  createTalonExchange,
  pickTalonGroup,
  isLegalDiscard,
  discardCards,
  getDiscardPool,
} from "./talon/talon.js";
export type { TalonExchangeRound } from "./talon/talon.js";
export {
  calculateGameScore,
  applyRadlci,
  roundToNearest5,
  CONTRACT_BASE_VALUES,
  BONUS_BASE_VALUES,
  RADLC_AWARDING_CONTRACTS,
  NO_DIFFERENCE_CONTRACTS,
} from "./scoring/game-scoring.js";
export type { TeamScoreResult, GameScoreResult, BonusResult } from "./scoring/game-scoring.js";
export {
  createAnnouncementsRound,
  placeAnnouncement,
  placeContra,
  canPlaceContra,
  passAnnouncements,
  getCurrentAnnouncingPlayer,
  ANNOUNCEMENTS,
} from "./announcements/announcements.js";
export type {
  AnnouncementType,
  PlayerAnnouncement,
  AnnouncementsRound,
  ContraTarget,
} from "./announcements/announcements.js";
export {
  createInitialGameState,
  getBiddingRound,
  getExchangeCount,
  getHand,
  getLegalBidsForState,
} from "./state/state.js";
export { settleGame } from "./scoring/settlement.js";
export type {
  GameSettlement,
  PlayerSettlement,
  SettlementOptions,
  SettlementRole,
} from "./scoring/settlement.js";
export { applyAction, getActionPlayer } from "./state/actions.js";
export type { GameAction } from "./state/actions.js";
export type { GameState, GameStateConfig, GamePhase } from "./state/state.js";
export {
  dispatchBid,
  dispatchCall,
  dispatchTalonPick,
  dispatchDiscard,
  dispatchRaiseToBarvniValat,
  dispatchAnnouncement,
  dispatchAnnouncementPass,
  dispatchContra,
  dispatchPlay,
  canMakeAnnouncement,
  getAnnouncementError,
  getGameLegalPlays,
} from "./state/state.js";
