import type { GameState, Card, PlayerId, BiddingAction, Bid, AnnouncementType } from "@tarok/engine";
import { 
  getLegalPlays, PASS, getTrickWinner, isTarokCard, isSuitCard, countPoints, tarokStrength, suitStrength
} from "@tarok/engine";
import type { TarokBot } from "./random-bot.js";

export type BotDifficulty = 1 | 2 | 3 | 4 | 5;

export class HeuristicBot implements TarokBot {
  constructor(
    public readonly playerId: PlayerId,
    public readonly difficulty: BotDifficulty
  ) {}

  chooseBid(state: GameState): BiddingAction {
    if (this.difficulty === 1) return PASS;

    const myHand = state.hands[this.playerId] || [];
    const taroksCount = myHand.filter(isTarokCard).length;
    
    // Very simple bidding heuristic:
    // Level 2+ bids "tri" if they have 6 or more taroks.
    // Level 4+ bids "dve" or "ena" if they have 8 or more.
    if (taroksCount >= 8 && this.difficulty >= 4) {
      return "dve"; // Simplification: we don't handle outbidding dynamically in this snippet perfectly, we just bid "dve" if possible
    }
    if (taroksCount >= 6 && this.difficulty >= 2) {
      return "tri";
    }

    return PASS;
  }

  chooseCalledKing(state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined {
    const suits = ["hearts", "spades", "clubs", "diamonds"] as const;
    if (this.difficulty <= 2) {
      return suits[Math.floor(Math.random() * suits.length)];
    }

    // Level 3+: Call a king in a suit where we have many cards, or call missing king.
    // Simplification: just pick a suit where we DON'T have the king, but we have pip cards.
    const myHand = state.hands[this.playerId] || [];
    for (const suit of suits) {
      const hasKing = myHand.some(c => isSuitCard(c) && c.suit === suit && c.rank === "king");
      if (!hasKing) {
        return suit;
      }
    }

    return "hearts";
  }

  chooseTalonGroup(state: GameState): number {
    if (!state.talon || state.talonGroups?.length === 0) return 0;
    
    if (this.difficulty <= 2) {
      return Math.floor(Math.random() * state.talonGroups!.length);
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

  chooseDiscards(state: GameState, hand: readonly Card[], count: number): readonly Card[] {
    const discardable = hand.filter(c => {
      if (isTarokCard(c)) {
        return c.rank !== "skis" && c.rank !== 1 && !(c.rank === 21 && c.name === "mond");
      }
      if (isSuitCard(c) && c.rank === "king") return false;
      return true;
    });

    const suitCards = discardable.filter(isSuitCard);
    const taroks = discardable.filter(isTarokCard);

    if (this.difficulty === 1) {
      // Random legal discard
      const combined = [...suitCards, ...taroks].sort(() => Math.random() - 0.5);
      return combined.slice(0, count);
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
    // Advanced bots could announce trula if they hold it, but we'll skip for now.
    return [];
  }

  choosePlay(state: GameState, hand: readonly Card[]): Card {
    const trick = state.trickRound?.currentTrick;
    if (!trick) throw new Error("No active trick");

    const legalPlays = getLegalPlays(hand, trick);
    if (legalPlays.length === 1) return legalPlays[0]!;

    // LEVEL 1: Random
    if (this.difficulty === 1) {
      return legalPlays[Math.floor(Math.random() * legalPlays.length)]!;
    }

    // Sort legal plays by power
    const tarokPlays = legalPlays.filter(isTarokCard).sort((a, b) => tarokStrength(a) - tarokStrength(b));
    const suitPlays = legalPlays.filter(isSuitCard).sort((a, b) => suitStrength(a) - suitStrength(b));
    const sortedPlays = [...suitPlays, ...tarokPlays]; // Lowest suit to highest tarok roughly

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
    const canBeat = (candidate: Card, currentWinner: Card) => {
      // Create a mock trick to see who wins
      const mockTrick = { leader: trick.leader, plays: [...trick.plays, { playerId: this.playerId, card: candidate }] };
      const newWinner = getTrickWinner(mockTrick);
      return newWinner.playerId === this.playerId;
    };

    // LEVEL 5: Partner awareness and Tarok counting
    let partnerId: PlayerId | undefined = undefined;
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
      const safePlays = legalPlays.filter(c => !canBeat(c, winningCard!));
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

        if (!winningCard || canBeat(candidate, winningCard)) {
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
