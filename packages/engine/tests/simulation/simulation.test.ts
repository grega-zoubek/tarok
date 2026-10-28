import { describe, it, expect } from "vitest";
import { 
  createTarokDeck, shuffle, deal, createInitialGameState, createSeededRng,
  dispatchBid, dispatchCall, dispatchTalonPick, dispatchDiscard,
  dispatchRaiseToBarvniValat,
  dispatchAnnouncementPass, dispatchPlay, PASS, isLegalBid, type Bid
} from "../../src/index.js";
import { HeuristicBot } from "../../../ai/src/bot/heuristic-bot.js";

describe("Tarok Game Simulation (4 Bots)", () => {
  it("should complete a full game cycle from start to finish", () => {
    // 1. Setup
    let deck = createTarokDeck();
    deck = shuffle(deck, createSeededRng(12345)); // Seeded for determinism
    const dealResult = deal(deck, { playerCount: 4 });
    
    let state = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands: {
        0: dealResult.hands[0]!,
        1: dealResult.hands[1]!,
        2: dealResult.hands[2]!,
        3: dealResult.hands[3]!,
      },
      initialTalon: dealResult.talon,
    });

    const bots = [
      new HeuristicBot(0, 3),
      new HeuristicBot(1, 3),
      new HeuristicBot(2, 3),
      new HeuristicBot(3, 3),
    ];

    console.log("Starting simulation...");

    // 2. Play the game loop
    let iterations = 0;
    const MAX_ITERATIONS = 500; // Safety break

    while (state.phase !== "finished" && iterations < MAX_ITERATIONS) {
      const currentPlayerId = state.currentPlayer;
      if (currentPlayerId === undefined) {
          console.log("Current player is undefined. Ending simulation.");
          break;
      }

      const bot = bots[currentPlayerId]!;
      
      try {
        switch (state.phase) {
          case "bidding":
            // IMPROVED BIDDING LOGIC FOR SIMULATION
            // A real bot might return 'tri' but someone else already bid 'dve'.
            // The simulation loop needs to handle this by checking legality.
            let bid = bot.chooseBid(state);
            
            // If the bot chose a bid that is no longer legal, it must pass
            if (bid !== PASS && !isLegalBid({
              playerOrder: state.playerOrder,
              forehand: state.forehand,
              currentPlayerIndex: state.playerOrder.indexOf(state.currentPlayer!),
              bids: state.bids,
              passedPlayers: state.passedPlayers,
              currentHighestBid: state.contract && state.contract !== "klop" ? { playerId: state.declarer!, bid: state.contract as Bid } : undefined,
              isFinished: false,
            }, currentPlayerId, bid as Bid)) {
                bid = PASS;
            }

            state = dispatchBid(state, currentPlayerId, bid);
            console.log(`P${currentPlayerId} bids: ${bid}. New Phase: ${state.phase}`);
            break;
          
          case "calling":
            const suit = bot.chooseCalledKing(state);
            state = dispatchCall(state, currentPlayerId, suit);
            console.log(`P${currentPlayerId} calls king: ${suit}`);
            break;
          
          case "talon":
            if (state.pickedTalonGroupIndex === undefined) {
              const groupIndex = bot.chooseTalonGroup(state);
              state = dispatchTalonPick(state, currentPlayerId, groupIndex);
              console.log(`P${currentPlayerId} picks talon group: ${groupIndex}`);
            } else {
              let exchangeCount: 3 | 2 | 1 = 3;
              if (state.contract === "dve" || state.contract === "solo_dve") exchangeCount = 2;
              if (state.contract === "ena" || state.contract === "solo_ena") exchangeCount = 1;
              
              const hand = state.hands[currentPlayerId]!;
              const discards = bot.chooseDiscards(state, hand, exchangeCount);
              state = dispatchDiscard(state, currentPlayerId, discards);
              console.log(`P${currentPlayerId} discards ${discards.length} cards`);
            }
            break;

          case "raising": {
            const raise = bot.chooseRaiseToBarvniValat(state);
            state = dispatchRaiseToBarvniValat(state, currentPlayerId, raise);
            console.log(`P${currentPlayerId} raise to barvni: ${raise}`);
            break;
          }
          
          case "announcements":
            state = dispatchAnnouncementPass(state, currentPlayerId);
            console.log(`P${currentPlayerId} passes announcements`);
            break;
          
          case "playing":
            const trickHand = state.trickRound?.hands.find(h => h.playerId === currentPlayerId)?.cards || [];
            const card = bot.choosePlay(state, trickHand);
            state = dispatchPlay(state, currentPlayerId, card);
            if (state.trickRound?.currentTrick.plays.length === 0) {
                console.log(`--- Trick completed. Last winner: ${state.trickRound.capturedTricks[state.trickRound.capturedTricks.length-1]?.winner}`);
            }
            break;
        }
      } catch (e) {
          console.error(`Simulation Error at Iteration ${iterations}:`, e);
          throw e;
      }
      
      iterations++;
    }

    expect(state.phase).toBe("finished");
    console.log(`Simulation finished in ${iterations} moves. Contract was: ${state.contract}`);
  });
});
