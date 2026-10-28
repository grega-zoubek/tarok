/**
 * Represents all possible valid bids (contracts) in standard Slovenian Tarok.
 * The order here implicitly represents the priority/value of the bids from lowest to highest,
 * excluding "klop" which is a special state when everyone passes.
 */
export const BIDS = [
  "tri",
  "dve",
  "ena",
  "solo_tri",
  "solo_dve",
  "solo_ena",
  "berac",
  "solo_brez",
  "odprti_berac",
  "barvni_valat",
  "valat",
] as const;

export type Bid = (typeof BIDS)[number];

/**
 * A pass action during bidding.
 */
export const PASS = "naprej";
export type Pass = typeof PASS;

export type BiddingAction = Bid | Pass;

export type PlayerId = number;

export interface BiddingRound {
  readonly playerOrder: readonly PlayerId[];
  readonly forehand: PlayerId;
  readonly currentPlayerIndex: number;
  readonly bids: readonly { readonly playerId: PlayerId; readonly action: BiddingAction }[];
  readonly passedPlayers: readonly PlayerId[];
  readonly currentHighestBid: { readonly playerId: PlayerId; readonly bid: Bid } | undefined;
  readonly isFinished: boolean;
  /** Obvezni klop: licitacije do berača vključno niso dovoljene. */
  readonly compulsoryKlop?: boolean;
}

export interface BiddingRoundConfig {
  readonly playerOrder: readonly PlayerId[];
  readonly forehand: PlayerId;
  readonly compulsoryKlop?: boolean;
}

/**
 * Checks the rank/priority of a bid. Higher number means higher priority.
 */
export function getBidPriority(bid: Bid): number {
  const index = BIDS.indexOf(bid);
  if (index === -1) {
    throw new Error(`Unknown bid: ${bid}`);
  }
  return index;
}

export function createBiddingRound(config: BiddingRoundConfig): BiddingRound {
  if (config.playerOrder.length !== 4) {
    throw new Error("Tarok bidding requires exactly 4 players");
  }
  
  if (!config.playerOrder.includes(config.forehand)) {
    throw new Error("Forehand must be one of the players");
  }

  const forehandIndex = config.playerOrder.indexOf(config.forehand);

  return {
    playerOrder: [...config.playerOrder],
    forehand: config.forehand,
    // Bidding starts with the forehand
    currentPlayerIndex: forehandIndex,
    bids: [],
    passedPlayers: [],
    currentHighestBid: undefined,
    isFinished: false,
    compulsoryKlop: config.compulsoryKlop === true,
  };
}

export function getCurrentBiddingPlayer(round: BiddingRound): PlayerId | undefined {
  if (round.isFinished) return undefined;
  return round.playerOrder[round.currentPlayerIndex];
}

/** Najnižja dovoljena licitacija pri obveznem klopu (solo_brez in višje). */
export const COMPULSORY_KLOP_MIN_BID: Bid = "solo_brez";

/** Solo pogodbe, ki jih gre po talonu dvigniti v barvni valat. */
export const SOLO_RAISABLE_TO_BARVNI = new Set<Bid>(["solo_tri", "solo_dve", "solo_ena"]);

export function isBidAllowedInCompulsoryKlop(bid: Bid): boolean {
  return getBidPriority(bid) >= getBidPriority(COMPULSORY_KLOP_MIN_BID);
}

/**
 * Returns whether a given bid is legal for the current player.
 * @param compulsoryKlop — pri obveznem klopu so licitacije do berača vključno prepovedane
 */
export function isLegalBid(
  round: BiddingRound,
  playerId: PlayerId,
  bid: Bid,
  compulsoryKlop = false,
): boolean {
  if (round.isFinished || getCurrentBiddingPlayer(round) !== playerId) {
    return false;
  }

  if (compulsoryKlop && !isBidAllowedInCompulsoryKlop(bid)) {
    return false;
  }

  // If there's no highest bid yet, any (allowed) bid is legal
  if (!round.currentHighestBid) {
    return true;
  }

  const newBidPriority = getBidPriority(bid);
  const currentPriority = getBidPriority(round.currentHighestBid.bid);

  // Forehand has the privilege to hold (izenačiti)
  if (playerId === round.forehand) {
    return newBidPriority >= currentPriority;
  }

  // Everyone else must strictly outbid
  return newBidPriority > currentPriority;
}

export function placeBid(round: BiddingRound, playerId: PlayerId, action: BiddingAction): BiddingRound {
  if (round.isFinished) {
    throw new Error("Bidding round is already finished");
  }

  if (getCurrentBiddingPlayer(round) !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn to bid`);
  }

  if (action !== PASS && !isLegalBid(round, playerId, action, round.compulsoryKlop === true)) {
    throw new Error(`Neveljavna licitacija ${action} za igralca ${playerId}`);
  }

  const nextBids = [...round.bids, { playerId, action }];
  let nextPassedPlayers = [...round.passedPlayers];
  let nextHighestBid = round.currentHighestBid;

  if (action === PASS) {
    nextPassedPlayers.push(playerId);
  } else {
    nextHighestBid = { playerId, bid: action };
  }

  // Check if bidding is finished.
  // Bidding finishes if:
  // 1. 3 players have passed, AND
  // 2. We either have a valid highest bid, or all 4 players passed (Klop situation).
  // Wait, if everyone passes on their first turn, it's Klop.
  // If a bid has been made, bidding continues until all but one player passes.
  const allPassed = nextPassedPlayers.length === 4;
  const threePassedWithBid = nextPassedPlayers.length === 3 && nextHighestBid !== undefined;

  const isFinished = allPassed || threePassedWithBid;

  // Find the next player who hasn't passed
  let nextPlayerIndex = (round.currentPlayerIndex + 1) % 4;
  if (!isFinished) {
    let candidate = round.playerOrder[nextPlayerIndex];
    if (candidate === undefined) {
        throw new Error("Invalid player index");
    }
    
    while (nextPassedPlayers.includes(candidate)) {
      nextPlayerIndex = (nextPlayerIndex + 1) % 4;
      candidate = round.playerOrder[nextPlayerIndex];
      if (candidate === undefined) {
        throw new Error("Invalid player index");
      }
    }
  }

  return {
    ...round,
    bids: nextBids,
    passedPlayers: nextPassedPlayers,
    currentHighestBid: nextHighestBid,
    isFinished,
    currentPlayerIndex: isFinished ? -1 : nextPlayerIndex,
    compulsoryKlop: round.compulsoryKlop === true,
  };
}

export interface BiddingResult {
  readonly contract: Bid | "klop";
  readonly declarer: PlayerId | undefined;
}

export function resolveBidding(round: BiddingRound): BiddingResult {
  if (!round.isFinished) {
    throw new Error("Cannot resolve unfinished bidding round");
  }

  if (round.currentHighestBid === undefined) {
    return { contract: "klop", declarer: undefined };
  }

  return {
    contract: round.currentHighestBid.bid,
    declarer: round.currentHighestBid.playerId,
  };
}
