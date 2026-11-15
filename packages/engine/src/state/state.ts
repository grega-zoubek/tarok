import { type Card, isSuitCard, isTarokCard, cardsEqual } from "../cards/card.js";
import { type PlayerId, type Bid, type BiddingAction, type BiddingRound, getLegalBids, placeBid, getCurrentBiddingPlayer, resolveBidding } from "../bidding/bidding.js";
import { SUITS, type Suit } from "../cards/suit.js";
import { type CalledKing, type Teams, determineTeams } from "../calling/calling.js";
import { type TrickRound, createTrickRound, playTurn, playTurnKlop, beginNextTrick, isTrickComplete, getCurrentPlayer } from "../game/trick-round.js";
import { pickTalonGroup, createTalonExchange, discardCards } from "../talon/talon.js";
import { hasTrula } from "../scoring/scoring.js";

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
  /** True, če je klicani kralj v talonu (deklarant igra sam). */
  readonly calledKingInTalon: boolean;
  readonly teams: Teams | undefined;

  // Talon Exchange State
  readonly pickedTalonGroupIndex: number | undefined;
  readonly talonGroups: readonly (readonly Card[])[];
  readonly discardedCards: readonly Card[];

  // Announcements State
  readonly announcementsRound: AnnouncementsRound | undefined;

  // Trick Playing State
  readonly trickRound: TrickRound | undefined;
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
    calledKingInTalon: false,
    teams: undefined,

    pickedTalonGroupIndex: undefined,
    talonGroups: [],
    discardedCards: [],
    
    announcementsRound: undefined,

    trickRound: undefined,
  };
}

/** Število kart, ki jih deklarant zamenja s talonom, glede na pogodbo. */
export function getExchangeCount(contract: Bid | "klop" | undefined): 3 | 2 | 1 {
  if (contract === "dve" || contract === "solo_dve") return 2;
  if (contract === "ena" || contract === "solo_ena") return 1;
  return 3;
}

/**
 * Vrne roko igralca. Med igranjem je vir resnice `trickRound.hands`,
 * pred tem pa `hands` (pred izmenjavo talona).
 */
export function getHand(state: GameState, playerId: PlayerId): readonly Card[] {
  const roundHand = state.trickRound?.hands.find((h) => h.playerId === playerId);
  if (roundHand !== undefined) return roundHand.cards;
  return state.hands[playerId] ?? [];
}

/** Kdo odpre prvi štih pri pogodbah brez talona. */
function getOpeningLeader(
  contract: Bid | "klop",
  declarer: PlayerId,
  playerOrder: readonly PlayerId[],
): PlayerId {
  // Berač: prvi štih odpre igralec levo od deklaranta (naslednji po vrstnem redu).
  if (contract === "berac" || contract === "odprti_berac") {
    const index = playerOrder.indexOf(declarer);
    return playerOrder[(index + 1) % playerOrder.length]!;
  }
  return declarer;
}

function syncHands(
  state: GameState,
  trickRound: TrickRound,
): Record<PlayerId, readonly Card[]> {
  const hands: Record<PlayerId, readonly Card[]> = { ...state.hands };
  for (const hand of trickRound.hands) {
    hands[hand.playerId] = hand.cards;
  }
  return hands;
}

/** Zgradi `BiddingRound` iz trenutnega stanja (za `isLegalBid`/`getLegalBids`). */
export function getBiddingRound(state: GameState): BiddingRound {
  return {
    playerOrder: state.playerOrder,
    forehand: state.forehand,
    currentPlayerIndex:
      state.currentPlayer !== undefined
        ? state.playerOrder.indexOf(state.currentPlayer)
        : -1,
    bids: state.bids,
    passedPlayers: state.passedPlayers,
    currentHighestBid:
      state.contract && state.contract !== "klop"
        ? { playerId: state.declarer!, bid: state.contract }
        : undefined,
    isFinished: state.phase !== "bidding",
  };
}

/** Licitacije, ki jih igralec na potezi trenutno sme izbrati. */
export function getLegalBidsForState(state: GameState): readonly Bid[] {
  if (state.phase !== "bidding" || state.currentPlayer === undefined) {
    return [];
  }
  return getLegalBids(getBiddingRound(state), state.currentPlayer);
}

/**
 * Barve, katerih kralja deklarant sme klicati: vseh štirih, če ima vse
 * kralje (tiha sola), sicer samo barve, katerih kralja nima v roki.
 */
export function getCallableSuits(state: GameState): readonly Suit[] {
  if (state.phase !== "calling" || state.declarer === undefined) {
    return [];
  }
  const hand = getHand(state, state.declarer);
  const kingCount = hand.filter((c) => isSuitCard(c) && c.rank === "king").length;
  if (kingCount === 4) {
    return SUITS;
  }
  return SUITS.filter(
    (suit) => !hand.some((c) => isSuitCard(c) && c.rank === "king" && c.suit === suit),
  );
}

export function dispatchBid(state: GameState, playerId: PlayerId, action: BiddingAction): GameState {
  if (state.phase !== "bidding") {
    throw new Error(`Cannot bid in phase ${state.phase}`);
  }

  const nextBiddingRound = placeBid(getBiddingRound(state), playerId, action);
  
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
  let nextPhase: GamePhase;
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
    const talonRound = createTalonExchange(
      result.declarer!,
      state.talon,
      getExchangeCount(result.contract),
    );
    nextTalonGroups = talonRound.talonGroups;
  }

  const openingLeader =
    nextPhase !== "playing"
      ? undefined
      : result.declarer !== undefined
        ? getOpeningLeader(result.contract, result.declarer, state.playerOrder)
        : state.forehand;

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
          leader: openingLeader!,
        })
      : undefined,
    // Napovedi vedno začne aktivni igralec (deklarant).
    announcementsRound: nextPhase === "announcements"
      ? createAnnouncementsRound(state.playerOrder, result.declarer!, result.declarer!)
      : undefined,
    currentPlayer:
      nextPhase === "playing"
        ? openingLeader
        : nextPhase === "announcements"
          ? result.declarer
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

  if (state.declarer !== playerId) {
    throw new Error(`Only declarer ${state.declarer} can call a king`);
  }

  let calledKing: CalledKing | undefined = undefined;

  if (suit) {
    const declarerHand = state.hands[playerId] ?? [];
    const declarerKings = declarerHand.filter(
      (card) => isSuitCard(card) && card.rank === "king",
    ).length;
    const callsOwnKing = declarerHand.some(
      (card) => isSuitCard(card) && card.rank === "king" && card.suit === suit,
    );

    // Klicati moraš barvo, katere kralja NIMAŠ v roki. Izjema: če imaš vse
    // štiri kralje, itak igraš sam (tiha sola).
    if (callsOwnKing && declarerKings < 4) {
      throw new Error(
        `Declarer cannot call a king they already hold (${suit}); call another suit.`,
      );
    }

    calledKing = { suit, rank: "king" };
  }

  const calledKingInTalon =
    calledKing !== undefined &&
    state.talon.some(
      (card) => isSuitCard(card) && card.rank === "king" && card.suit === calledKing!.suit,
    );

  // Teams are determined based on the call
  const teams = determineTeams(state.hands as Record<PlayerId, import("../cards/card.js").SuitCard[]>, state.declarer!, calledKing);

  const talonRound = createTalonExchange(
    state.declarer!,
    state.talon,
    getExchangeCount(state.contract),
  );

  return {
    ...state,
    phase: "talon",
    currentPlayer: state.declarer, // Ensure declarer stays as current player for talon pick
    calledKing,
    calledKingInTalon,
    teams,
    talonGroups: talonRound.talonGroups,
  };
}

/**
 * Če je klicani kralj v talonu, mora deklarant obvezno vzeti skupino, ki ga
 * vsebuje. Vrne indeks te skupine ali undefined, kadar izbira ni omejena.
 */
export function getRequiredTalonGroup(state: GameState): number | undefined {
  if (!state.calledKingInTalon || state.calledKing === undefined) return undefined;
  const index = state.talonGroups.findIndex((group) =>
    group.some(
      (card) =>
        isSuitCard(card) &&
        card.rank === "king" &&
        card.suit === state.calledKing!.suit,
    ),
  );
  return index >= 0 ? index : undefined;
}

export function dispatchTalonPick(state: GameState, playerId: PlayerId, groupIndex: number): GameState {
  if (state.phase !== "talon") {
    throw new Error(`Cannot pick talon in phase ${state.phase}`);
  }
  
  if (state.currentPlayer !== playerId || state.declarer !== playerId) {
    throw new Error(`Only declarer ${state.declarer} can pick talon, not player ${playerId}`);
  }

  const requiredGroup = getRequiredTalonGroup(state);
  if (requiredGroup !== undefined && groupIndex !== requiredGroup) {
    throw new Error(
      "Klicani kralj je v talonu: vzeti moraš kupček, ki vsebuje klicanega kralja.",
    );
  }

  const talonRound = createTalonExchange(
    playerId,
    state.talon,
    getExchangeCount(state.contract),
  );
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

  const exchangeCount = getExchangeCount(state.contract);

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
    // Napovedi vedno začne aktivni igralec (deklarant).
    announcementsRound: createAnnouncementsRound(state.playerOrder, state.declarer!, state.declarer!),
    currentPlayer: state.declarer,
  };
}

/**
 * Vrne razlog, zakaj igralec ne sme napovedati, ali undefined, če sme.
 * Uporablja ga tudi UI za prikaz dovoljenih gumbov.
 */
export function getAnnouncementError(
  state: GameState,
  playerId: PlayerId,
  announcementType: AnnouncementType,
): string | undefined {
  if (state.phase !== "announcements" || !state.announcementsRound) {
    return `Cannot announce in phase ${state.phase}`;
  }

  const round = state.announcementsRound;
  if (round.isFinished) {
    return "Announcements round is already finished";
  }

  if (getCurrentAnnouncingPlayer(round) !== playerId) {
    return `It is not player ${playerId}'s turn to announce`;
  }

  if ((round.announcements[playerId] ?? []).some(a => a.type === announcementType)) {
    return `Player ${playerId} has already announced ${announcementType}`;
  }

  const hand = getHand(state, playerId);
  const declarerTeam =
    state.teams?.declarerTeam ??
    (state.declarer !== undefined ? [state.declarer] : []);

  switch (announcementType) {
    case "pagat_ultimo":
      if (!hand.some(c => isTarokCard(c) && c.rank === 1)) {
        return "Samo igralec, ki ima pagata, lahko napove pagat ultimo.";
      }
      return undefined;

    case "trula":
      // Napoved trulo sme dati le igralec, ki ima vse tri trula v roki.
      if (!hasTrula(hand)) {
        return "Trulo lahko napove samo igralec, ki ima pagata, monda in škisa.";
      }
      return undefined;

    case "kralji":
      return undefined;

    case "kralj_ultimo": {
      if (!state.calledKing) {
        return state.declarer === playerId
          ? undefined
          : "Solo igra: samo deklarant lahko napove kralj ultimo.";
      }
      if (state.calledKingInTalon) {
        return state.declarer === playerId
          ? undefined
          : "Klicani kralj je v talonu; kralj ultimo lahko napove samo deklarant.";
      }
      const holdsCalledKing = hand.some(
        c => isSuitCard(c) && c.rank === "king" && c.suit === state.calledKing!.suit,
      );
      return holdsCalledKing
        ? undefined
        : "Samo igralec, ki ima klicanega kralja, lahko napove kralj ultimo.";
    }

    case "valat":
      return declarerTeam.includes(playerId)
        ? undefined
        : "Valat lahko napove samo aktivna ekipa.";
  }
}

export function dispatchAnnouncement(state: GameState, playerId: PlayerId, announcementType: AnnouncementType): GameState {
  const error = getAnnouncementError(state, playerId, announcementType);
  if (error !== undefined) {
    throw new Error(error);
  }

  const nextRound = placeAnnouncement(
    state.announcementsRound!,
    playerId,
    announcementType,
  );

  return {
    ...state,
    announcementsRound: nextRound,
    currentPlayer: getCurrentAnnouncingPlayer(nextRound),
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
          hands: syncHands(state, nextTrickRound),
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
          hands: syncHands(state, nextTrickRound),
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
    hands: syncHands(state, nextTrickRound),
    trickRound: nextTrickRound,
  };
}

