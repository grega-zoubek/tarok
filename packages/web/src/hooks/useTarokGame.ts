import { useState, useEffect } from "react";
import { 
  type GameState, 
  createTarokDeck, 
  shuffle, 
  deal, 
  createInitialGameState, 
  type PlayerId, 
  createSeededRng,
  dispatchBid,
  dispatchCall,
  dispatchTalonPick,
  dispatchDiscard,
  dispatchAnnouncementPass,
  dispatchPlay,
  type BiddingAction,
  type Card
} from "@tarok/engine";
import { HeuristicBot } from "@tarok/ai";

export function useTarokGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bots, setBots] = useState<HeuristicBot[]>([]);
  
  // Player 0 is the human
  const HUMAN_PLAYER: PlayerId = 0;

  // Initialize game
  const startGame = () => {
    let deck = createTarokDeck();
    deck = shuffle(deck, createSeededRng(Math.random()));
    
    // Using standard 4-player layout
    const dealResult = deal(deck, { playerCount: 4 });
    
    const initialHands: Record<PlayerId, typeof deck> = {
      0: dealResult.hands[0]!,
      1: dealResult.hands[1]!,
      2: dealResult.hands[2]!,
      3: dealResult.hands[3]!,
    };

    const newState = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: 0,
      initialHands,
      initialTalon: dealResult.talon,
    });

    // Initialize bots (Players 1, 2, 3) with Level 3 difficulty
    setBots([
      new HeuristicBot(1, 3),
      new HeuristicBot(2, 3),
      new HeuristicBot(3, 3),
    ]);

    setGameState(newState);
  };

  // Basic game loop hook for bot actions
  useEffect(() => {
    if (!gameState || gameState.phase === "finished") return;

    if (gameState.currentPlayer !== undefined && gameState.currentPlayer !== HUMAN_PLAYER) {
      // It's a bot's turn
      const currentBot = bots.find(b => b.playerId === gameState.currentPlayer);
      if (!currentBot) return;

      const timer = setTimeout(() => {
        let nextState = gameState;
        
        switch (gameState.phase) {
          case "bidding":
            const bid = currentBot.chooseBid(gameState);
            nextState = dispatchBid(gameState, currentBot.playerId, bid);
            break;
            
          case "calling":
            const suit = currentBot.chooseCalledKing(gameState);
            nextState = dispatchCall(gameState, currentBot.playerId, suit);
            break;
            
          case "talon":
            if (gameState.pickedTalonGroupIndex === undefined) {
              const groupIndex = currentBot.chooseTalonGroup(gameState);
              nextState = dispatchTalonPick(gameState, currentBot.playerId, groupIndex);
            } else {
              // Get exchange count based on contract
              let exchangeCount = 3;
              if (gameState.contract === "dve" || gameState.contract === "solo_dve") exchangeCount = 2;
              if (gameState.contract === "ena" || gameState.contract === "solo_ena") exchangeCount = 1;
              
              const hand = nextState.hands[currentBot.playerId]!;
              const discards = currentBot.chooseDiscards(gameState, hand, exchangeCount);
              nextState = dispatchDiscard(gameState, currentBot.playerId, discards);
            }
            break;
            
          case "announcements":
            // Currently bots just pass for simplicity
            nextState = dispatchAnnouncementPass(gameState, currentBot.playerId);
            break;
            
          case "playing":
            const hand = gameState.hands[currentBot.playerId]!;
            const cardToPlay = currentBot.choosePlay(gameState, hand);
            nextState = dispatchPlay(gameState, currentBot.playerId, cardToPlay);
            break;
        }

        setGameState(nextState);
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [gameState, bots]);

  // Human actions
  const playBid = (action: BiddingAction) => {
    if (!gameState || gameState.phase !== "bidding" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchBid(gameState, HUMAN_PLAYER, action));
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  const playCall = (suit: "hearts" | "spades" | "clubs" | "diamonds" | undefined) => {
    if (!gameState || gameState.phase !== "calling" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchCall(gameState, HUMAN_PLAYER, suit));
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  const playTalonPick = (groupIndex: number) => {
    if (!gameState || gameState.phase !== "talon" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchTalonPick(gameState, HUMAN_PLAYER, groupIndex));
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  const playDiscard = (cards: Card[]) => {
    if (!gameState || gameState.phase !== "talon" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchDiscard(gameState, HUMAN_PLAYER, cards));
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  const playAnnouncementPass = () => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchAnnouncementPass(gameState, HUMAN_PLAYER));
    } catch (e) {
      console.error(e);
      alert((e as Error).message);
    }
  };

  const playCard = (card: Card) => {
    if (!gameState || gameState.phase !== "playing" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchPlay(gameState, HUMAN_PLAYER, card));
    } catch (e) {
      console.error(e);
      alert("Nelegalna poteza: " + (e as Error).message);
    }
  };

  return {
    gameState,
    startGame,
    HUMAN_PLAYER,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playAnnouncementPass,
    playCard
  };
}