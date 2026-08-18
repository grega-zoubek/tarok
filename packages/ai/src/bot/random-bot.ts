import type { GameState, Card, PlayerId, BiddingAction, Bid, AnnouncementType } from "@tarok/engine";
import { getLegalPlays, PASS, BIDS, ANNOUNCEMENTS } from "@tarok/engine";

/**
 * Interface representing a Tarok AI bot.
 * The bot evaluates the current game state and its hand, and returns the chosen action.
 */
export interface TarokBot {
  readonly playerId: PlayerId;
  
  /** Decide on a bid during the bidding phase */
  chooseBid(state: GameState): BiddingAction;
  
  /** Decide which King to call if the bot wins the bidding */
  chooseCalledKing(state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined;
  
  /** Decide which Talon group to pick */
  chooseTalonGroup(state: GameState): number;
  
  /** Decide which cards to discard from the hand after picking the Talon */
  chooseDiscards(state: GameState, hand: readonly Card[], count: number): readonly Card[];
  
  /** Decide which announcements to make */
  chooseAnnouncements(state: GameState): readonly AnnouncementType[];
  
  /** Decide which card to play in the current trick */
  choosePlay(state: GameState, hand: readonly Card[]): Card;
}

/**
 * A basic implementation of a Tarok Bot that makes random but legal moves.
 * Useful for automated testing and as a fallback.
 */
export class RandomBot implements TarokBot {
  constructor(public readonly playerId: PlayerId) {}

  chooseBid(state: GameState): BiddingAction {
    // 50% chance to pass, 50% chance to make the lowest legal bid (or just pass for simplicity)
    // To prevent infinite games, mostly pass unless they are forehand
    return PASS;
  }

  chooseCalledKing(state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined {
    // Randomly pick a suit
    const suits = ["hearts", "spades", "clubs", "diamonds"] as const;
    return suits[Math.floor(Math.random() * suits.length)];
  }

  chooseTalonGroup(state: GameState): number {
    if (!state.talon || state.talon.length === 0) return 0;
    // We can't know exchangeCount directly easily, but we know the groups will be available.
    // If it's a 3-exchange, there are 2 groups. 2-exchange -> 3 groups. 1-exchange -> 6 groups.
    // Assuming standard exchange sizes based on contract...
    // Actually, picking group 0 is always safe and legal.
    return 0;
  }

  chooseDiscards(state: GameState, hand: readonly Card[], count: number): readonly Card[] {
    // Find valid discards.
    // A more advanced engine hook like `getLegalDiscards` would be useful, but for a random bot,
    // we just take the first N non-5-point cards that are not Taroks if possible.
    const discardable = hand.filter(c => {
      if (c.kind === "tarok") {
        return c.rank !== "skis" && c.rank !== 1 && !(c.rank === 21 && c.name === "mond");
      }
      if (c.kind === "suit" && c.rank === "king") return false;
      return true;
    });

    // Prefer discarding suit cards over taroks
    const suitCards = discardable.filter(c => c.kind === "suit");
    const tarokCards = discardable.filter(c => c.kind === "tarok");

    const result: Card[] = [];
    
    for (let i = 0; i < count; i++) {
      if (suitCards.length > 0) {
        result.push(suitCards.pop()!);
      } else if (tarokCards.length > 0) {
        result.push(tarokCards.pop()!);
      } else {
        throw new Error("Bot cannot find enough valid cards to discard (this implies hand is full of Kings/Trula)");
      }
    }

    return result;
  }

  chooseAnnouncements(state: GameState): readonly AnnouncementType[] {
    // Random bot doesn't make any announcements to be safe
    return [];
  }

  choosePlay(state: GameState, hand: readonly Card[]): Card {
    if (!state.trickRound) {
      throw new Error("Cannot play: trick round is not active");
    }

    const legalPlays = getLegalPlays(hand, state.trickRound.currentTrick);
    if (legalPlays.length === 0) {
      throw new Error("Bot has no legal plays");
    }

    // Play a random legal card
    const randomIndex = Math.floor(Math.random() * legalPlays.length);
    return legalPlays[randomIndex]!;
  }
}