import type { GameState, Card, PlayerId, BiddingAction, Bid, AnnouncementType, Suit } from "@tarok/engine";
import {
  getLegalPlays,
  getKlopLegalPlays,
  getBarvniValatLegalPlays,
  getBarvniValatTrickWinner,
  PASS,
  getTrickWinner,
  isTarokCard,
  isSuitCard,
  countPoints,
  tarokStrength,
  suitStrength,
  hasTrula,
  hasAllKings,
  isLegalBid,
  SOLO_RAISABLE_TO_BARVNI,
  getCardValue,
} from "@tarok/engine";
import type { TarokBot } from "./random-bot.js";

export type BotDifficulty = 1 | 2 | 3 | 4 | 5;

const SUITS: readonly Suit[] = ["hearts", "spades", "clubs", "diamonds"];

/** Partner is secret until the called king is played (or there is no called king). */
function isCalledKingRevealed(state: GameState): boolean {
  if (!state.calledKing) return true;
  const suit = state.calledKing.suit;
  const seen = (card: Card) =>
    isSuitCard(card) && card.rank === "king" && card.suit === suit;
  if (state.discardedCards.some(seen)) return true;
  if (!state.trickRound) return false;
  for (const ct of state.trickRound.capturedTricks) {
    if (ct.trick.plays.some((p) => seen(p.card))) return true;
  }
  return state.trickRound.currentTrick.plays.some((p) => seen(p.card));
}

function suitCounts(hand: readonly Card[]): Record<Suit, number> {
  const counts = { hearts: 0, spades: 0, clubs: 0, diamonds: 0 };
  for (const c of hand) {
    if (isSuitCard(c)) counts[c.suit] += 1;
  }
  return counts;
}

function isDiscardable(c: Card): boolean {
  if (isTarokCard(c)) {
    return c.rank !== "skis" && c.rank !== 1 && !(c.rank === 21 && c.name === "mond");
  }
  if (isSuitCard(c) && c.rank === "king") return false;
  return true;
}

function biddingMockFromState(state: GameState, playerId: PlayerId) {
  return {
    playerOrder: state.playerOrder,
    forehand: state.forehand,
    currentPlayerIndex: state.playerOrder.indexOf(playerId),
    bids: state.bids,
    passedPlayers: state.passedPlayers,
    currentHighestBid:
      state.contract && state.contract !== "klop"
        ? { playerId: state.declarer!, bid: state.contract as Bid }
        : undefined,
    isFinished: false,
    compulsoryKlop: state.compulsoryKlop,
  };
}

export class HeuristicBot implements TarokBot {
  constructor(
    public readonly playerId: PlayerId,
    public readonly difficulty: BotDifficulty,
  ) {}

  chooseBid(state: GameState): BiddingAction {
    if (this.difficulty === 1) return PASS;

    const myHand = state.hands[this.playerId] || [];
    const taroksCount = myHand.filter(isTarokCard).length;
    const hasSkis = myHand.some((c) => isTarokCard(c) && c.rank === "skis");
    const hasMond = myHand.some((c) => isTarokCard(c) && c.rank === 21);
    const kings = myHand.filter((c) => isSuitCard(c) && c.rank === "king").length;
    const mock = biddingMockFromState(state, this.playerId);
    const compulsory = state.compulsoryKlop === true;

    const tryBid = (bid: Bid): BiddingAction | undefined => {
      if (isLegalBid(mock, this.playerId, bid, compulsory)) return bid;
      return undefined;
    };

    // Level 5 with a monster hand: try solo / solo_brez under compulsory klop
    if (this.difficulty >= 5 && taroksCount >= 10 && hasSkis && hasMond) {
      const b = tryBid(compulsory ? "solo_brez" : "solo_tri");
      if (b) return b;
    }
    if (this.difficulty >= 5 && taroksCount >= 9 && kings >= 2 && hasSkis) {
      const b = tryBid(compulsory ? "solo_brez" : "solo_dve");
      if (b) return b;
    }
    if (!compulsory) {
      if (taroksCount >= 9 && this.difficulty >= 4) {
        const b = tryBid("ena");
        if (b) return b;
      }
      if (taroksCount >= 8 && this.difficulty >= 4) {
        const b = tryBid("dve");
        if (b) return b;
      }
      if (taroksCount >= 6 && this.difficulty >= 2) {
        const b = tryBid("tri");
        if (b) return b;
      }
    } else if (this.difficulty >= 4 && taroksCount >= 9 && hasSkis) {
      const b = tryBid("solo_brez");
      if (b) return b;
    }

    return PASS;
  }

  chooseCalledKing(state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined {
    if (this.difficulty <= 2) {
      return SUITS[Math.floor(Math.random() * SUITS.length)];
    }

    const myHand = state.hands[this.playerId] || [];
    // Prefer a suit we don't hold the king of, with the longest remaining length (partner help)
    let best: Suit | undefined;
    let bestLen = -1;
    for (const suit of SUITS) {
      const hasKing = myHand.some((c) => isSuitCard(c) && c.suit === suit && c.rank === "king");
      if (hasKing) continue;
      const len = myHand.filter((c) => isSuitCard(c) && c.suit === suit).length;
      if (len > bestLen) {
        bestLen = len;
        best = suit;
      }
    }
    return best ?? "hearts";
  }

  chooseTalonGroup(state: GameState): number {
    if (!state.talon || state.talonGroups?.length === 0) return 0;

    if (this.difficulty <= 2) {
      return Math.floor(Math.random() * state.talonGroups!.length);
    }

    const myHand = state.hands[this.playerId] || [];
    const hasSkis = myHand.some((c) => isTarokCard(c) && c.rank === "skis");
    const counts = suitCounts(myHand);

    let bestIndex = 0;
    let bestScore = -Infinity;

    state.talonGroups!.forEach((group, index) => {
      let score = countPoints(group) * 2;
      // Prefer Mond if we hold Škis (mondfang safety / control)
      if (hasSkis && group.some((c) => isTarokCard(c) && c.rank === 21)) score += 12;
      // Prefer cards that deepen an existing suit void opportunity (short suits)
      for (const c of group) {
        if (isSuitCard(c)) {
          if (counts[c.suit] === 0) score += 4; // already void — less useful
          if (counts[c.suit] === 1 || counts[c.suit] === 2) score += 3; // helps voiding later? actually lengthens — mild
        }
      }
      // Prefer taroks for control at higher difficulties
      score += group.filter(isTarokCard).length * (this.difficulty >= 4 ? 3 : 1);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  chooseDiscards(state: GameState, hand: readonly Card[], count: number): readonly Card[] {
    const discardable = hand.filter(isDiscardable);
    const suitCards = discardable.filter(isSuitCard);
    const taroks = discardable.filter(isTarokCard);

    if (this.difficulty === 1) {
      const combined = [...suitCards, ...taroks].sort(() => Math.random() - 0.5);
      return combined.slice(0, count);
    }

    // Level 3+: bank high-point suit cards into own pile AND create voids
    if (this.difficulty >= 3) {
      const counts = suitCounts(hand);
      // Sort suits by length ascending (void shortest first), then by total point value in that suit
      const bySuit = SUITS.map((suit) => ({
        suit,
        cards: suitCards
          .filter((c) => c.suit === suit)
          .sort((a, b) => getCardValue(b) - getCardValue(a)),
        len: counts[suit],
      })).filter((s) => s.cards.length > 0);

      bySuit.sort((a, b) => {
        // Prefer suits we can fully void with `count` discards
        const aCanVoid = a.len <= count ? 0 : 1;
        const bCanVoid = b.len <= count ? 0 : 1;
        if (aCanVoid !== bCanVoid) return aCanVoid - bCanVoid;
        if (a.len !== b.len) return a.len - b.len;
        return 0;
      });

      const result: Card[] = [];
      const used = new Set<string>();
      const key = (c: Card) =>
        isTarokCard(c) ? `t:${c.rank}` : `s:${c.suit}:${c.rank}`;

      // First pass: void short suits (taking highest points from them)
      for (const group of bySuit) {
        if (result.length >= count) break;
        if (group.len > count - result.length && group.len > 2) continue;
        for (const c of group.cards) {
          if (result.length >= count) break;
          result.push(c);
          used.add(key(c));
        }
      }

      // Fill with remaining highest-point suit cards, then low taroks
      const leftoverSuits = suitCards
        .filter((c) => !used.has(key(c)))
        .sort((a, b) => getCardValue(b) - getCardValue(a));
      for (const c of leftoverSuits) {
        if (result.length >= count) break;
        result.push(c);
      }
      const lowTaroks = [...taroks].sort((a, b) => tarokStrength(a) - tarokStrength(b));
      for (const c of lowTaroks) {
        if (result.length >= count) break;
        result.push(c);
      }
      return result.slice(0, count);
    }

    // Level 2: bank high points
    suitCards.sort((a, b) => getCardValue(b) - getCardValue(a));
    taroks.sort((a, b) => tarokStrength(a) - tarokStrength(b));
    return [...suitCards, ...taroks].slice(0, count);
  }

  chooseAnnouncements(state: GameState): readonly AnnouncementType[] {
    if (this.difficulty < 4) return [];
    const myHand = state.hands[this.playerId] || [];
    const anns: AnnouncementType[] = [];
    if (hasTrula(myHand)) anns.push("trula");
    if (hasAllKings(myHand)) anns.push("kralji");
    if (
      this.difficulty >= 5 &&
      myHand.some((c) => isTarokCard(c) && c.rank === 1) &&
      myHand.filter(isTarokCard).length >= 8
    ) {
      anns.push("pagat_ultimo");
    }
    return anns;
  }

  /** After solo talon: raise to barvni valat if the hand looks like a colour sweep. */
  chooseRaiseToBarvniValat(state: GameState): boolean {
    if (this.difficulty < 4) return false;
    if (!state.contract || !SOLO_RAISABLE_TO_BARVNI.has(state.contract as Bid)) return false;
    const hand = state.hands[this.playerId] || [];
    const taroks = hand.filter(isTarokCard).length;
    const suits = suitCounts(hand);
    const voids = SUITS.filter((s) => suits[s] === 0).length;
    const longSuit = Math.max(...SUITS.map((s) => suits[s]));
    // Need strong suit control and not too many "dead" taroks blocking colour play
    return voids >= 2 && longSuit >= 5 && taroks <= 6 && this.difficulty >= 5
      ? true
      : voids >= 3 && longSuit >= 6;
  }

  choosePlay(state: GameState, hand: readonly Card[]): Card {
    const trick = state.trickRound?.currentTrick;
    if (!trick) throw new Error("No active trick");

    const isKlop = state.contract === "klop";
    const isNegat = state.contract === "berac" || state.contract === "odprti_berac";
    const isBarvni = state.contract === "barvni_valat";
    const winnerFn = isBarvni ? getBarvniValatTrickWinner : getTrickWinner;
    const legalPlays =
      isBarvni && state.declarer === this.playerId
        ? getBarvniValatLegalPlays(hand, trick)
        : isKlop || isNegat
          ? getKlopLegalPlays(hand, trick)
          : getLegalPlays(hand, trick);
    if (legalPlays.length === 1) return legalPlays[0]!;

    if (this.difficulty === 1) {
      return legalPlays[Math.floor(Math.random() * legalPlays.length)]!;
    }

    const tarokPlays = legalPlays.filter(isTarokCard).sort((a, b) => tarokStrength(a) - tarokStrength(b));
    const suitPlays = legalPlays.filter(isSuitCard).sort((a, b) => suitStrength(a) - suitStrength(b));
    const sortedPlays = [...suitPlays, ...tarokPlays];

    if (isKlop || isNegat) {
      const klopSorted = [...legalPlays].sort((a, b) => {
        const aT = isTarokCard(a),
          bT = isTarokCard(b);
        if (aT !== bT) return aT ? 1 : -1;
        if (aT && bT) return tarokStrength(a) - tarokStrength(b);
        return suitStrength(a as Extract<Card, { kind: "suit" }>) - suitStrength(b as Extract<Card, { kind: "suit" }>);
      });
      return klopSorted[0]!;
    }

    if (this.difficulty === 2) {
      return sortedPlays[0]!;
    }

    let currentWinnerId: PlayerId | undefined;
    let winningCard: Card | undefined;
    if (trick.plays.length > 0) {
      const winningPlay = winnerFn(trick);
      currentWinnerId = winningPlay.playerId;
      winningCard = winningPlay.card;
    }

    const allPlayed = this.getAllPlayedCards(state);
    const isSkisPlayed = allPlayed.some((c) => isTarokCard(c) && c.rank === "skis");
    const remainingTaroks = this.countRemainingTaroks(state, hand);
    const cardsLeft = hand.length;

    const canBeat = (candidate: Card) => {
      const mockTrick = {
        leader: trick.leader,
        plays: [...trick.plays, { playerId: this.playerId, card: candidate }],
      };
      return winnerFn(mockTrick).playerId === this.playerId;
    };

    let isPartnerWinning = false;
    if (this.difficulty === 5 && state.teams && isCalledKingRevealed(state)) {
      const myTeam = state.teams.declarerTeam.includes(this.playerId)
        ? state.teams.declarerTeam
        : state.teams.defendingTeam;
      if (currentWinnerId !== undefined && myTeam.includes(currentWinnerId)) {
        isPartnerWinning = true;
      }

      if (trick.plays.length === 0 && state.declarer === this.playerId && tarokPlays.length > 0) {
        for (let i = tarokPlays.length - 1; i >= 0; i--) {
          const t = tarokPlays[i]!;
          if (t.rank === 21 && t.name === "mond" && !isSkisPlayed) continue;
          if (t.rank === 1 && t.name === "pagat") continue;
          return t;
        }
      }
    }

    // Endgame (≤3 cards): prefer guaranteed winners / dump points safely
    if (this.difficulty >= 4 && cardsLeft <= 3) {
      if (isPartnerWinning) {
        const safe = legalPlays.filter((c) => !canBeat(c)).sort((a, b) => countPoints([b]) - countPoints([a]));
        if (safe[0]) return safe[0];
      }
      // Don't force Mond under Škis — duck if we can
      const endangeredMond = (c: Card) =>
        isTarokCard(c) && c.rank === 21 && c.name === "mond" && !isSkisPlayed;
      const duck = legalPlays
        .filter((c) => winningCard && !canBeat(c))
        .sort((a, b) => countPoints([a]) - countPoints([b]));
      if (duck.length > 0 && legalPlays.some(endangeredMond)) {
        return duck[0]!;
      }
      const winners = legalPlays.filter(
        (c) => (!winningCard || canBeat(c)) && !endangeredMond(c),
      );
      if (winners.length > 0) {
        return winners.sort((a, b) => countPoints([a]) - countPoints([b]))[0]!;
      }
    }

    if (this.difficulty === 5 && isPartnerWinning) {
      const safePlays = legalPlays.filter((c) => !canBeat(c));
      if (safePlays.length > 0) {
        return safePlays.sort((a, b) => countPoints([b]) - countPoints([a]))[0]!;
      }
    }

    if (!isPartnerWinning || this.difficulty < 5) {
      for (const candidate of sortedPlays) {
        if (this.difficulty >= 4 && isTarokCard(candidate)) {
          if (candidate.rank === 21 && candidate.name === "mond" && !isSkisPlayed) {
            // Play Mond only if Škis is out OR we're last to a trick we must take and few taroks remain
            if (!(remainingTaroks <= 2 && trick.plays.length === 3) && tarokPlays.length > 1) {
              continue;
            }
          }
          if (candidate.rank === 1 && candidate.name === "pagat" && tarokPlays.length > 1 && cardsLeft > 1) {
            continue;
          }
        }
        if (!winningCard || canBeat(candidate)) {
          return candidate;
        }
      }
    }

    const garbagePlays = sortedPlays.filter((c) => {
      if (this.difficulty >= 4) {
        if (isTarokCard(c) && c.rank === 21 && c.name === "mond") return false;
        if (isTarokCard(c) && c.rank === 1 && c.name === "pagat") return false;
        if (isSuitCard(c) && c.rank === "king") return false;
      }
      return true;
    });

    if (garbagePlays.length > 0) return garbagePlays[0]!;
    return sortedPlays[0]!;
  }

  private getAllPlayedCards(state: GameState): Card[] {
    const played: Card[] = [];
    if (state.discardedCards) played.push(...state.discardedCards);
    if (state.trickRound) {
      state.trickRound.capturedTricks.forEach((t) => t.trick.plays.forEach((p) => played.push(p.card)));
      state.trickRound.currentTrick.plays.forEach((p) => played.push(p.card));
    }
    // Unpicked talon counts as "out" for defenders' pile (visible after open)
    if (state.talonGroups.length > 0 && state.pickedTalonGroupIndex !== undefined) {
      state.talonGroups.forEach((g, i) => {
        if (i !== state.pickedTalonGroupIndex) played.push(...g);
      });
    }
    return played;
  }

  /** Taroks still unaccounted for (not in our hand and not seen played). */
  private countRemainingTaroks(state: GameState, hand: readonly Card[]): number {
    const seen = new Set(
      this.getAllPlayedCards(state)
        .filter(isTarokCard)
        .map((c) => (c.rank === "skis" ? "skis" : String(c.rank))),
    );
    for (const c of hand) {
      if (isTarokCard(c)) seen.add(c.rank === "skis" ? "skis" : String(c.rank));
    }
    return 22 - seen.size;
  }
}
