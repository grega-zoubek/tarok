import type { GameState, Card, PlayerId, BiddingAction, AnnouncementType, Rng } from "@tarok/engine";
import { 
  countPoints, getAnnouncementError, getCallableSuits, getDiscardPool, getHand, getKlopLegalPlays,
  getLegalBidsForState, getLegalPlays, getRequiredTalonGroup, getTrickWinner,
  hasAllKings, hasTrula, isSuitCard, isTarokCard, nextInt, PASS, shuffle, suitStrength, tarokStrength,
} from "@tarok/engine";
import type { TarokBot } from "./random-bot.js";

export type BotDifficulty = 1 | 2 | 3 | 4 | 5;

/** RNG, ki se uporablja, kadar bot ne dobi svojega (deterministični testi). */
const defaultRng: Rng = { next: () => Math.random() };

export class HeuristicBot implements TarokBot {
  constructor(
    public readonly playerId: PlayerId,
    public readonly difficulty: BotDifficulty,
    private readonly rng: Rng = defaultRng
  ) {}

  chooseBid(state: GameState): BiddingAction {
    if (this.difficulty === 1) return PASS;

    const myHand = getHand(state, this.playerId);
    const taroksCount = myHand.filter(isTarokCard).length;
    
    // Very simple bidding heuristic:
    // Level 2+ bids "tri" if they have 6 or more taroks.
    // Level 4+ bids "dve" or "ena" if they have 8 or more.
    const legal = getLegalBidsForState(state);
    if (taroksCount >= 8 && this.difficulty >= 4 && legal.includes("dve")) {
      return "dve";
    }
    if (taroksCount >= 6 && this.difficulty >= 2 && legal.includes("tri")) {
      return "tri";
    }

    return PASS;
  }

  chooseCalledKing(state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined {
    const myHand = getHand(state, this.playerId);
    const kings = ["hearts", "diamonds", "clubs", "spades"].filter((suit) =>
      myHand.some(c => isSuitCard(c) && c.suit === suit && c.rank === "king"),
    );
    // Vsi štirje kralji: igra sam (tiha sola), zato ne kliče kralja.
    if (kings.length === 4) return undefined;

    const callable = getCallableSuits(state);
    if (callable.length === 0) return undefined;
    if (this.difficulty <= 2) {
      return callable[nextInt(this.rng, callable.length)];
    }

    // Level 3+: kliči barvo, v kateri ima največ kart (partner bo nosil kralja).
    let bestSuit = callable[0]!;
    let bestCount = -1;
    for (const suit of callable) {
      const count = myHand.filter(c => isSuitCard(c) && c.suit === suit).length;
      if (count > bestCount) {
        bestCount = count;
        bestSuit = suit;
      }
    }
    return bestSuit;
  }

  chooseTalonGroup(state: GameState): number {
    if (!state.talon || state.talonGroups?.length === 0) return 0;

    // Klicani kralj v talonu: izbira skupine ni prosta.
    const requiredGroup = getRequiredTalonGroup(state);
    if (requiredGroup !== undefined) return requiredGroup;

    if (this.difficulty <= 2) {
      return nextInt(this.rng, state.talonGroups!.length);
    }

    // Level 3+: Pick the group with the highest point value
    let bestIndex = 0;
    let maxPoints = -1;

    state.talonGroups!.forEach((group, index) => {
      const pts = countPoints(group);
      if (pts > maxPoints) {
        maxPoints = pts;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  chooseDiscards(_state: GameState, hand: readonly Card[], count: number): readonly Card[] {
    // Engine omeji nabor: 5-točkovnih kart ni mogoče založiti, taroke pa le,
    // kadar ni dovolj barvnih kart.
    const discardable = getDiscardPool(hand, count);

    const suitCards = discardable.filter(isSuitCard);
    const taroks = discardable.filter(isTarokCard);

    if (this.difficulty === 1) {
      // Random legal discard (deterministično ob injektiranem RNG)
      return shuffle([...suitCards, ...taroks], this.rng).slice(0, count);
    }

    // Level 2+: Try to discard suit cards first, starting from highest points (Queens -> Cavaliers -> Jacks -> Pips)
    // Actually, wait, we want to discard pip cards (1 pt) if we want to save high value cards?
    // No, standard strategy is to discard valuable cards (Queens, Cavs) to our own pile to save points!
    // But we must create a void. Let's simplify: sort suit cards by value descending.
    suitCards.sort((a, b) => countPoints([b]) - countPoints([a]));
    taroks.sort((a, b) => tarokStrength(a) - tarokStrength(b));

    const result: Card[] = [];
    
    // Level 4+: Try to create a void (empty suit) by discarding all cards of a suit if possible.
    // For now, simple greedy approach: Discard highest value suit cards first.
    let remaining = count;
    for (const sc of suitCards) {
      if (remaining > 0) { result.push(sc); remaining--; }
    }
    for (const tc of taroks) {
      if (remaining > 0) { result.push(tc); remaining--; }
    }

    return result;
  }

  chooseAnnouncements(state: GameState): readonly AnnouncementType[] {
    if (state.phase !== "announcements" || this.difficulty < 4) return [];

    const hand = getHand(state, this.playerId);
    const candidates: AnnouncementType[] = [];
    if (hasTrula(hand)) candidates.push("trula");
    if (hasAllKings(hand)) candidates.push("kralji");

    if (this.difficulty >= 5) {
      if (hand.some(c => isTarokCard(c) && c.rank === 1)) {
        candidates.push("pagat_ultimo");
      }
      if (
        state.calledKing !== undefined &&
        hand.some(
          c =>
            isSuitCard(c) &&
            c.suit === state.calledKing!.suit &&
            c.rank === "king",
        )
      ) {
        candidates.push("kralj_ultimo");
      }
    }

    // Napovej le tisto, kar je v tem trenutku res dovoljeno.
    return candidates.filter(
      (type) => getAnnouncementError(state, this.playerId, type) === undefined,
    );
  }

  choosePlay(state: GameState, hand: readonly Card[]): Card {
    const trick = state.trickRound?.currentTrick;
    if (!trick) throw new Error("No active trick");

    // Klop / berač / odprti berač: moraš iti čez (višja karta če jo imaš)
    const isKlop = state.contract === "klop";
    const isNegat  = state.contract === "berac" || state.contract === "odprti_berac";
    const legalPlays = (isKlop || isNegat) ? getKlopLegalPlays(hand, trick) : getLegalPlays(hand, trick);
    if (legalPlays.length === 1) return legalPlays[0]!;

    // LEVEL 1: Random (deterministično ob injektiranem RNG)
    if (this.difficulty === 1) {
      return legalPlays[nextInt(this.rng, legalPlays.length)]!;
    }

    // Sort legal plays by power
    const tarokPlays = legalPlays.filter(isTarokCard).sort((a, b) => tarokStrength(a) - tarokStrength(b));
    const suitPlays = legalPlays.filter(isSuitCard).sort((a, b) => suitStrength(a) - suitStrength(b));
    const sortedPlays = [...suitPlays, ...tarokPlays]; // Lowest suit to highest tarok roughly

    // ── KLOP / BERAČ strategija: izogibaj se štihem ──────────────────────────
    if (isKlop || isNegat) {
      // Vedno igraj najnižjo legalno karto (getKlopLegalPlays že filtrira)
      // Prednost: barvne karte < taroki (taroki so vrednejši)
      const klopSorted = [...legalPlays].sort((a, b) => {
        const aT = isTarokCard(a), bT = isTarokCard(b);
        if (aT !== bT) return aT ? 1 : -1; // barvne najprej
        if (aT && bT) return tarokStrength(a) - tarokStrength(b); // nižji tarok
        if (isSuitCard(a) && isSuitCard(b)) {
          return suitStrength(a) - suitStrength(b); // nižja barvna
        }
        return 0;
      });
      return klopSorted[0]!;
    }

    // LEVEL 2: Always play the weakest possible card to avoid losing points
    if (this.difficulty === 2) {
      return sortedPlays[0]!;
    }

    // LEVEL 3+: Try to win the trick, or play lowest
    let currentWinnerId: PlayerId | undefined = undefined;
    let winningCard: Card | undefined = undefined;

    if (trick.plays.length > 0) {
      const winningPlay = getTrickWinner(trick);
      currentWinnerId = winningPlay.playerId;
      winningCard = winningPlay.card;
    }

    // LEVEL 4+: Protect Mond and Pagat
    let isSkisPlayed = false;
    if (this.difficulty >= 4) {
      const allPlayedCards = this.getAllPlayedCards(state);
      isSkisPlayed = allPlayedCards.some(c => isTarokCard(c) && c.rank === "skis");
    }

    // Helper to evaluate if a card can beat the current winning card
    const canBeat = (candidate: Card) => {
      // Create a mock trick to see who wins
      const mockTrick = { leader: trick.leader, plays: [...trick.plays, { playerId: this.playerId, card: candidate }] };
      const newWinner = getTrickWinner(mockTrick);
      return newWinner.playerId === this.playerId;
    };

    // LEVEL 5: Partner awareness and Tarok counting
    let isPartnerWinning = false;

    if (this.difficulty === 5 && state.teams) {
      const myTeam = state.teams.declarerTeam.includes(this.playerId) ? state.teams.declarerTeam : state.teams.defendingTeam;
      if (currentWinnerId !== undefined && myTeam.includes(currentWinnerId)) {
        isPartnerWinning = true;
      }

      // If we are declarer and leading the trick, lead high taroks to draw them out
      if (trick.plays.length === 0 && state.declarer === this.playerId && tarokPlays.length > 0) {
        // Find highest tarok that isn't Mond in danger
        for (let i = tarokPlays.length - 1; i >= 0; i--) {
          const t = tarokPlays[i]!;
          if (t.rank === 21 && t.name === "mond" && !isSkisPlayed) continue;
          if (t.rank === 1 && t.name === "pagat") continue; // Save pagat
          return t;
        }
      }
    }

    // Strategy Execution:
    // If partner is winning (Level 5), and we are last or feel safe, play a high point card to give them points! (Schmear)
    if (this.difficulty === 5 && isPartnerWinning) {
      // Play highest point card that DOESN'T overtake the partner
      const safePlays = legalPlays.filter(c => !canBeat(c));
      if (safePlays.length > 0) {
        // Sort by points descending
        return safePlays.sort((a, b) => countPoints([b]) - countPoints([a]))[0]!;
      }
    }

    // Try to win the trick if partner is not winning
    if (!isPartnerWinning || this.difficulty < 5) {
      // Find the lowest card that can beat the current winner
      for (const candidate of sortedPlays) {
        // Level 4/5 Rules:
        if (this.difficulty >= 4 && isTarokCard(candidate)) {
          // Don't play Mond if Škis isn't played (unless forced)
          if (candidate.rank === 21 && candidate.name === "mond" && !isSkisPlayed) {
            if (tarokPlays.length > 1) continue; 
          }
          // Don't play Pagat to just win a random trick if we have other options
          if (candidate.rank === 1 && candidate.name === "pagat" && tarokPlays.length > 1) {
            continue;
          }
        }

        if (!winningCard || canBeat(candidate)) {
          return candidate;
        }
      }
    }

    // If we cannot win (or chose not to because of partner), play the absolute lowest garbage card we have
    // Level 4/5: Still avoid giving away Pagat or points if possible
    const garbagePlays = sortedPlays.filter(c => {
      if (this.difficulty >= 4) {
        if (isTarokCard(c) && c.rank === 21 && c.name === "mond") return false;
        if (isTarokCard(c) && c.rank === 1 && c.name === "pagat") return false;
        if (isSuitCard(c) && c.rank === "king") return false;
      }
      return true;
    });

    if (garbagePlays.length > 0) return garbagePlays[0]!;
    
    // Fallback if forced to play something valuable
    return sortedPlays[0]!;
  }

  private getAllPlayedCards(state: GameState): Card[] {
    const played: Card[] = [];
    if (state.discardedCards) played.push(...state.discardedCards);
    if (state.trickRound) {
      state.trickRound.capturedTricks.forEach(t => t.trick.plays.forEach(p => played.push(p.card)));
      state.trickRound.currentTrick.plays.forEach(p => played.push(p.card));
    }
    return played;
  }
}
