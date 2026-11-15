import type { GameState, Card, PlayerId, BiddingAction, AnnouncementType, ContraTarget, Rng } from "@tarok/engine";
import { getGameLegalPlays, nextInt, PASS } from "@tarok/engine";

/**
 * Interface representing a Tarok AI bot.
 * The bot evaluates the current game state and its hand, and returns the chosen action.
 */
export interface TarokBot {
  readonly playerId: PlayerId;
  
  /** Decide on a bid during the bidding phase */
  chooseBid(state: GameState): BiddingAction;
  
  /** Decide which King to call if the bot wins the bidding */
  chooseCalledKing(_state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined;
  
  /** Decide which Talon group to pick */
  chooseTalonGroup(state: GameState): number;
  
  /** Decide which cards to discard from the hand after picking the Talon */
  chooseDiscards(state: GameState, hand: readonly Card[], count: number): readonly Card[];
  
  /** Decide which announcements to make */
  chooseAnnouncements(state: GameState): readonly AnnouncementType[];

  /** Optionally place kontra / rekontra on game or an announcement */
  chooseContra?(state: GameState): ContraTarget | undefined;

  /** After solo talon exchange: optionally raise to barvni valat */
  chooseRaiseToBarvniValat?(state: GameState): boolean;
  
  /** Decide which card to play in the current trick */
  choosePlay(state: GameState, hand: readonly Card[]): Card;
}

/**
 * A basic implementation of a Tarok Bot that makes random but legal moves.
 * Useful for automated testing and as a fallback.
 */
const defaultRng: Rng = { next: () => Math.random() };

export class RandomBot implements TarokBot {
  constructor(
    public readonly playerId: PlayerId,
    private readonly rng: Rng = defaultRng
  ) {}

  chooseBid(_state: GameState): BiddingAction {
    // 50% chance to pass, 50% chance to make the lowest legal bid (or just pass for simplicity)
    // To prevent infinite games, mostly pass unless they are forehand
    return PASS;
  }

  chooseCalledKing(_state: GameState): "hearts" | "spades" | "clubs" | "diamonds" | undefined {
    // Randomly pick a suit
    const suits = ["hearts", "spades", "clubs", "diamonds"] as const;
    return suits[nextInt(this.rng, suits.length)];
  }

  chooseTalonGroup(state: GameState): number {
    if (!state.talon || state.talon.length === 0) return 0;
    // Picking group 0 is always safe and legal.
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

  chooseAnnouncements(_state: GameState): readonly AnnouncementType[] {
    // Random bot doesn't make any announcements to be safe
    return [];
  }

  choosePlay(state: GameState, hand: readonly Card[]): Card {
    if (!state.trickRound) {
      throw new Error("Cannot play: trick round is not active");
    }

    const legalPlays = getGameLegalPlays(state, this.playerId, hand);
    if (legalPlays.length === 0) {
      throw new Error("Bot has no legal plays");
    }

    // Play a random legal card
    return legalPlays[nextInt(this.rng, legalPlays.length)]!;
  }
}