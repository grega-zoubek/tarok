import { type Card, isSuitCard, isTarokCard, cardsEqual, cardKey } from "../cards/card.js";
import { type PlayerId, type Bid, type BiddingAction, PASS, getBidPriority, placeBid, getCurrentBiddingPlayer, resolveBidding } from "../bidding/bidding.js";
import { type CalledKing, type Teams, holdsKing, determineTeams } from "../calling/calling.js";
import { type TrickRound, createTrickRound, playTurn, playTurnKlop, resolveTrick, beginNextTrick, isTrickComplete, getCurrentPlayer } from "../game/trick-round.js";
import { isLegalDiscard, pickTalonGroup, createTalonExchange, discardCards } from "../talon/talon.js";

/**
 * Defines the main phases of a complete Tarok game.
 */
export type GamePhase = 
  | "bidding"
  | "calling"
  | "talon"
  | "announcements"
  | "playing"
  | "finished";

import { type AnnouncementsRound, createAnnouncementsRound, placeAnnouncement, passAnnouncements, type AnnouncementType, getCurrentAnnouncingPlayer } from "../announcements/announcements.js";

/**
 * Represents the complete state of a Tarok game at any point in time.
 */
export interface GameState {
  readonly phase: GamePhase;
  readonly playerOrder: readonly PlayerId[];
  readonly forehand: PlayerId;
  readonly currentPlayer: PlayerId | undefined;
  
  // Hands (hidden information in a real setting, but engine needs to know)
  readonly hands: Record<PlayerId, readonly Card[]>;
  readonly talon: readonly Card[];

  // Bidding State
  readonly bids: readonly { readonly playerId: PlayerId; readonly action: BiddingAction }[];
  readonly passedPlayers: readonly PlayerId[];
  readonly contract: Bid | "klop" | undefined;
  readonly declarer: PlayerId | undefined;

  // Calling State
  readonly calledKing: CalledKing | undefined;
  readonly teams: Teams | undefined;

  // Talon Exchange State
  readonly pickedTalonGroupIndex: number | undefined;
  readonly talonGroups: readonly (readonly Card[])[];
  readonly discardedCards: readonly Card[];

  // Announcements State
  readonly announcementsRound: AnnouncementsRound | undefined;

  // Trick Playing State
  readonly trickRound: TrickRound | undefined;

  // Radlci po igralcu (vsak začne z 0; podvojijo vrednost naslednje igre)
  readonly radlci: Record<PlayerId, number>;
}

export interface GameStateConfig {
  readonly playerOrder: readonly PlayerId[];
  readonly forehand: PlayerId;
  readonly initialHands: Record<PlayerId, readonly Card[]>;
  readonly initialTalon: readonly Card[];
}

export function createInitialGameState(config: GameStateConfig): GameState {
  if (config.playerOrder.length !== 4) {
    throw new Error("Game requires exactly 4 players");
  }

  return {
    phase: "bidding",
    playerOrder: [...config.playerOrder],
    forehand: config.forehand,
    currentPlayer: config.forehand,
    hands: { ...config.initialHands },
    talon: [...config.initialTalon],
    
    bids: [],
    passedPlayers: [],
    contract: undefined,
    declarer: undefined,

    calledKing: undefined,
    teams: undefined,

    pickedTalonGroupIndex: undefined,
    talonGroups: [],
    discardedCards: [],
    
    announcementsRound: undefined,

    trickRound: undefined,

    radlci: Object.fromEntries(config.playerOrder.map(pid => [pid, 0])) as Record<PlayerId, number>,
  };
}

export function dispatchBid(state: GameState, playerId: PlayerId, action: BiddingAction): GameState {
  if (state.phase !== "bidding") {
    throw new Error(`Cannot bid in phase ${state.phase}`);
  }

  // Construct a temporary BiddingRound object to use our existing bidding logic
  const biddingRound = {
    playerOrder: state.playerOrder,
    forehand: state.forehand,
    currentPlayerIndex: state.playerOrder.indexOf(state.currentPlayer!),
    bids: state.bids,
    passedPlayers: state.passedPlayers,
    currentHighestBid: state.contract && state.contract !== "klop" ? { playerId: state.declarer!, bid: state.contract as Bid } : undefined,
    isFinished: false,
  };

  const nextBiddingRound = placeBid(biddingRound, playerId, action);
  
  if (!nextBiddingRound.isFinished) {
    return {
      ...state,
      currentPlayer: getCurrentBiddingPlayer(nextBiddingRound),
      bids: nextBiddingRound.bids,
      passedPlayers: nextBiddingRound.passedPlayers,
      contract: nextBiddingRound.currentHighestBid?.bid,
      declarer: nextBiddingRound.currentHighestBid?.playerId,
    };
  }

  const result = resolveBidding(nextBiddingRound);
  let nextPhase: GamePhase = "finished"; // Default if something weird happens
  let nextTalonGroups: readonly (readonly Card[])[] = [];

  // Ekipe za pogodbe, ki preskočijo calling fazo
  let soloTeams: Teams | undefined = undefined;

  if (result.contract === "klop") {
    // Klop: ni deklaranta, posebno štetje — preskočimo calling in talon
    nextPhase = "playing";
  } else if (
    result.contract === "tri" ||
    result.contract === "dve" ||
    result.contract === "ena"
  ) {
    // Normalne pogodbe z ekipo — gredo v calling
    nextPhase = "calling";
  } else if (
    result.contract === "berac" ||
    result.contract === "odprti_berac" ||
    result.contract === "solo_brez"
  ) {
    // Berač / odprti berač / solo brez: brez talona, brez napovedi —
    // igra se takoj z originalno roko (preskočimo announcements).
    nextPhase = "playing";
    soloTeams = determineTeams(state.hands as Record<PlayerId, import("../cards/card.js").SuitCard[]>, result.declarer!);
  } else if (
    result.contract === "barvni_valat" ||
    result.contract === "valat"
  ) {
    // Valat igri — gredo skozi napovedi (valat se lahko napove)
    nextPhase = "announcements";
    soloTeams = determineTeams(state.hands as Record<PlayerId, import("../cards/card.js").SuitCard[]>, result.declarer!);
  } else {
    // Solo pogodbe (solo_tri, solo_dve, solo_ena) — menjava talona brez calling
    nextPhase = "talon";
    soloTeams = determineTeams(state.hands as Record<PlayerId, import("../cards/card.js").SuitCard[]>, result.declarer!);
    let exchangeCount: 3 | 2 | 1 = 3;
    if (result.contract === "solo_dve") exchangeCount = 2;
    if (result.contract === "solo_ena") exchangeCount = 1;
    const talonRound = createTalonExchange(result.declarer!, state.talon, exchangeCount);
    nextTalonGroups = talonRound.talonGroups;
  }

  const finalState: GameState = {
    ...state,
    phase: nextPhase,
    bids: nextBiddingRound.bids,
    passedPlayers: nextBiddingRound.passedPlayers,
    contract: result.contract,
    declarer: result.declarer,
    teams: soloTeams,          // undefined za klop/calling; nastavljeno za solo/berač/valat
    talonGroups: nextTalonGroups,
    // Klop / berač / odprti berač / solo brez začnejo takoj igrati brez calling/talon
    trickRound: nextPhase === "playing"
      ? createTrickRound({
          playerOrder: state.playerOrder,
          hands: Object.entries(state.hands).map(([id, cards]) => ({ playerId: Number(id), cards })),
          leader: (result.contract === "berac" || result.contract === "odprti_berac" || result.contract === "solo_brez")
            ? result.declarer!
            : state.forehand,
        })
      : undefined,
    // Samo valat igri gresta skozi napovedi; berač/odprti_berač/solo_brez brez napovedi
    announcementsRound: nextPhase === "announcements"
      ? createAnnouncementsRound(state.playerOrder, result.declarer!, state.forehand)
      : undefined,
    currentPlayer:
      nextPhase === "playing"
        ? (result.contract === "berac" || result.contract === "odprti_berac" || result.contract === "solo_brez")
          ? result.declarer
          : state.forehand
        : nextPhase === "announcements"
          ? state.forehand
          : result.declarer,
  };

  return finalState;
}
export function dispatchCall(state: GameState, playerId: PlayerId, suit: "hearts" | "spades" | "clubs" | "diamonds" | undefined): GameState {
  if (state.phase !== "calling") {
    throw new Error(`Cannot call in phase ${state.phase}`);
  }
  
  if (state.currentPlayer !== playerId) {
    throw new Error(`It is not player ${playerId}'s turn to call`);
  }

  let calledKing: CalledKing | undefined = undefined;

  if (suit) {
    calledKing = { suit, rank: "king" };
  }
  
  // Teams are determined based on the call
  const teams = determineTeams(state.hands as Record<PlayerId, import("../cards/card.js").SuitCard[]>, state.declarer!, calledKing);

  // Initialize talon groups for the next phase
  let exchangeCount: 3 | 2 | 1 = 3;
  if (state.contract === "dve") exchangeCount = 2;
  if (state.contract === "ena") exchangeCount = 1;

  const talonRound = createTalonExchange(state.declarer!, state.talon, exchangeCount);

  return {
    ...state,
    phase: "talon",
    currentPlayer: state.declarer, // Ensure declarer stays as current player for talon pick
    calledKing,
    teams,
    talonGroups: talonRound.talonGroups,
  };
}

export function dispatchTalonPick(state: GameState, playerId: PlayerId, groupIndex: number): GameState {
  if (state.phase !== "talon") {
    throw new Error(`Cannot pick talon in phase ${state.phase}`);
  }
  
  if (state.currentPlayer !== playerId || state.declarer !== playerId) {
    throw new Error(`Only declarer ${state.declarer} can pick talon, not player ${playerId}`);
  }

  // Talon counts 
  let exchangeCount: 3 | 2 | 1 = 3;
  if (state.contract === "dve" || state.contract === "solo_dve") exchangeCount = 2;
  if (state.contract === "ena" || state.contract === "solo_ena") exchangeCount = 1;

  const talonRound = createTalonExchange(playerId, state.talon, exchangeCount);
  const pickedRound = pickTalonGroup(talonRound, playerId, groupIndex);

  // Add the picked cards to the hand immediately
  const pickedCards = pickedRound.talonGroups[groupIndex] || [];
  const nextHands = { ...state.hands };
  nextHands[playerId] = [...nextHands[playerId]!, ...pickedCards];

  return {
    ...state,
    currentPlayer: playerId, // Stay as current player for discard phase
    pickedTalonGroupIndex: groupIndex,
    hands: nextHands,
  };
}

export function dispatchDiscard(state: GameState, playerId: PlayerId, discardedCards: readonly Card[]): GameState {
  if (state.phase !== "talon") {
    throw new Error(`Cannot discard in phase ${state.phase}`);
  }

  if (state.currentPlayer !== playerId || state.declarer !== playerId) {
    throw new Error(`Only declarer ${state.declarer} can discard, not player ${playerId}`);
  }

  if (state.pickedTalonGroupIndex === undefined) {
    throw new Error("Cannot discard without picking a talon group first");
  }

  let exchangeCount: 3 | 2 | 1 = 3;
  if (state.contract === "dve" || state.contract === "solo_dve") exchangeCount = 2;
  if (state.contract === "ena" || state.contract === "solo_ena") exchangeCount = 1;

  const talonRound = {
    declarer: playerId,
    talon: state.talon,
    exchangeCount,
    isFinished: false,
    talonGroups: [], // Mocking for discard functionality
    pickedGroupIndex: state.pickedTalonGroupIndex,
    discardedCards: [],
  };

  const currentHand = state.hands[playerId]!;
  
  const result = discardCards(talonRound, playerId, discardedCards, currentHand);

  // Remove discarded cards from hand
  const newHand = currentHand.filter(card => !discardedCards.some(dc => cardsEqual(card, dc)));

  return {
    ...state,
    phase: "announcements",
    discardedCards: result.discardedCards,
    hands: {
      ...state.hands,
      [playerId]: newHand,
    },
    announcementsRound: createAnnouncementsRound(state.playerOrder, state.declarer!, state.forehand),
    currentPlayer: state.forehand, // standard announcements start with forehand
  };
}

export function dispatchAnnouncement(state: GameState, playerId: PlayerId, announcementType: AnnouncementType): GameState {
  if (state.phase !== "announcements" || !state.announcementsRound) {
    throw new Error(`Cannot announce in phase ${state.phase}`);
  }

  // ── Eligibility check per official rules (stevec-taroka.si / tarok.net) ──
  // Pagat ultimo: samo igralec, ki ima pagata (tarok I)
  if (announcementType === "pagat_ultimo") {
    const pagatHolder = state.playerOrder.find(pid =>
      (state.hands[pid] ?? []).some(c => isTarokCard(c) && c.rank === 1)
    );
    if (pagatHolder !== playerId) {
      throw new Error(`Samo igralec, ki ima pagata, lahko napove pagat ultimo.`);
    }
  }

  // Kralj ultimo: samo igralec, ki ima klicanega kralja (partner) oz. deklarant pri soloi gri
  if (announcementType === "kralj_ultimo") {
    if (state.calledKing) {
      const kingHolder = state.playerOrder.find(pid =>
        (state.hands[pid] ?? []).some(c => isSuitCard(c) && c.rank === "king" && c.suit === state.calledKing!.suit)
      );
      if (kingHolder !== playerId) {
        throw new Error(`Samo igralec, ki ima klicanega kralja, lahko napove kralj ultimo.`);
      }
    } else {
      // Solo pogodba brez klicanega kralja — samo deklarant
      if (state.declarer !== playerId) {
        throw new Error(`Solo igra: samo deklarant lahko napove kralj ultimo.`);
      }
    }
  }

  const nextRound = placeAnnouncement(state.announcementsRound, playerId, announcementType);

  return {
    ...state,
    announcementsRound: nextRound,
    // Turn stays with the current player until they pass
  };
}

export function dispatchAnnouncementPass(state: GameState, playerId: PlayerId): GameState {
  if (state.phase !== "announcements" || !state.announcementsRound) {
    throw new Error(`Cannot pass announcements in phase ${state.phase}`);
  }

  const nextRound = passAnnouncements(state.announcementsRound, playerId);

  if (nextRound.isFinished) {
    return {
      ...state,
      phase: "playing",
      announcementsRound: nextRound,
      trickRound: createTrickRound({
        playerOrder: state.playerOrder,
        hands: Object.entries(state.hands).map(([id, cards]) => ({ playerId: Number(id), cards })),
        leader: state.forehand,
      }),
      currentPlayer: state.forehand,
    };
  }

  return {
    ...state,
    announcementsRound: nextRound,
    currentPlayer: getCurrentAnnouncingPlayer(nextRound),
  };
}

export function dispatchPlay(state: GameState, playerId: PlayerId, card: Card): GameState {
  if (state.phase !== "playing" || !state.trickRound) {
    throw new Error(`Cannot play a card in phase ${state.phase}`);
  }

  // Klop / berač / odprti berač: moraš iti čez (višja karta če jo imaš)
  const useForcedHigher =
    state.contract === "klop" ||
    state.contract === "berac" ||
    state.contract === "odprti_berac";
  let nextTrickRound = useForcedHigher
    ? playTurnKlop(state.trickRound, playerId, card)
    : playTurn(state.trickRound, playerId, card);
  
  if (isTrickComplete(nextTrickRound)) {
    nextTrickRound = beginNextTrick(nextTrickRound);

    // ── Zgodnja prekinitev igre pri posebnih pogodbah ────────────────────────
    // Po vsakem zaključenem štihu preverimo ali je pogodba že odločena.
    const lastTrick = nextTrickRound.capturedTricks[nextTrickRound.capturedTricks.length - 1];
    if (lastTrick && state.declarer !== undefined) {
      const declarerTeam = state.teams?.declarerTeam ?? [state.declarer];
      const declarerWonLastTrick = declarerTeam.includes(lastTrick.winner);

      // Berač / Odprti berač: če deklarant osvoji štih → takojšen poraz
      if (
        (state.contract === "berac" || state.contract === "odprti_berac") &&
        declarerWonLastTrick
      ) {
        return {
          ...state,
          phase: "finished",
          currentPlayer: undefined,
          trickRound: nextTrickRound,
        };
      }

      // Valat / Barvni valat: če branilec osvoji štih → takojšen poraz deklaranta
      if (
        (state.contract === "valat" || state.contract === "barvni_valat") &&
        !declarerWonLastTrick
      ) {
        return {
          ...state,
          phase: "finished",
          currentPlayer: undefined,
          trickRound: nextTrickRound,
        };
      }
    }
    // ──────────────────────────────────────────────────────────
  }

  // Igra je končana ko so vse karte iz rok odigrane (vsak player brez kart)
  const isFinished = nextTrickRound.hands.every(h => h.cards.length === 0);

  return {
    ...state,
    phase: isFinished ? "finished" : "playing",
    currentPlayer: isFinished ? undefined : getCurrentPlayer(nextTrickRound),
    trickRound: nextTrickRound,
  };
}

