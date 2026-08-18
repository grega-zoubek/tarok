import { useState, useEffect, useCallback } from "react";
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
  dispatchAnnouncement,
  dispatchAnnouncementPass,
  dispatchPlay,
  type BiddingAction,
  type Card,
  isTarokCard,
  tarokStrength,
  isSuitCard,
  suitStrength,
  calculateGameScore,
  type GameScoreResult,
  type AnnouncementType
} from "@tarok/engine";
import { HeuristicBot, type BotDifficulty } from "@tarok/ai";

export interface BotConfig {
  name: string;
  difficulty: BotDifficulty;
}

export interface GameSettings {
  humanName: string;
  botConfigs: BotConfig[];
  maxRounds: number;
}

export interface RoundResult {
  round: number;
  contract: string;
  declarer: string;
  points: number;
  winnerTeam: "declarer" | "defenders";
}

export function useTarokGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bots, setBots] = useState<HeuristicBot[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [lastCapturedTrick, setLastCapturedTrick] = useState<any>(null);
  const [isProcessingTrick, setIsProcessingTrick] = useState(false);
  const [isMovingCards, setIsMovingCards] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [roundScore, setRoundScore] = useState<GameScoreResult | null>(null);
  
  // Player 0 is the human
  const HUMAN_PLAYER: PlayerId = 0;

  const sortCards = useCallback((cards: readonly Card[]): Card[] => {
    if (!cards) return [];
    const sorted = [...cards];
    return sorted.sort((a, b) => {
      if (isTarokCard(a) && !isTarokCard(b)) return -1;
      if (!isTarokCard(a) && isTarokCard(b)) return 1;
      if (isTarokCard(a) && isTarokCard(b)) return tarokStrength(b) - tarokStrength(a);
      if (isSuitCard(a) && isSuitCard(b)) {
        const suitOrder = { diamonds: 0, clubs: 1, hearts: 2, spades: 3 };
        if (a.suit !== b.suit) return suitOrder[a.suit] - suitOrder[b.suit];
        return suitStrength(b) - suitStrength(a);
      }
      return 0;
    });
  }, []);

  // Initialize game
  const startGame = (settings: GameSettings) => {
    setGameSettings(settings);
    setCurrentRound(1);
    setHistory([]);
    setRoundScore(null);
    startNewRound(settings, 1);
  };

  const nextRound = () => {
    if (!gameSettings || currentRound >= gameSettings.maxRounds) return;
    const nextR = currentRound + 1;
    setCurrentRound(nextR);
    setRoundScore(null);
    startNewRound(gameSettings, nextR);
  };

  const startNewRound = (settings: GameSettings, roundNum: number) => {
    let deck = createTarokDeck();
    const randomSeed = Math.floor(Math.random() * 1000000);
    deck = shuffle(deck, createSeededRng(randomSeed));
    const dealResult = deal(deck, { playerCount: 4 });
    
    const initialHands: Record<PlayerId, Card[]> = {
      0: sortCards(dealResult.hands[0]!),
      1: [...dealResult.hands[1]!],
      2: [...dealResult.hands[2]!],
      3: [...dealResult.hands[3]!],
    };

    const newState = createInitialGameState({
      playerOrder: [0, 1, 2, 3],
      forehand: ((roundNum - 1) % 4) as PlayerId,
      initialHands,
      initialTalon: dealResult.talon,
    });

    const newBots = settings.botConfigs.map((config, index) => 
      new HeuristicBot((index + 1) as PlayerId, config.difficulty)
    );

    setBots(newBots);
    setPlayerNames([settings.humanName, ...settings.botConfigs.map(b => b.name)]);
    setGameState(newState);
    setLastCapturedTrick(null);
    setIsProcessingTrick(false);
    setIsMovingCards(false);
  };

  // Basic game loop hook for bot actions
  useEffect(() => {
    if (!gameState || gameState.phase === "finished" || isProcessingTrick) {
      if (gameState?.phase === "finished" && !roundScore) {
          try {
              const score = calculateGameScore(gameState);
              setRoundScore(score);
              setHistory(prev => [...prev, {
                  round: currentRound,
                  contract: gameState.contract || "klop",
                  declarer: gameState.declarer !== undefined ? playerNames[gameState.declarer]! : "Nihče",
                  points: score.pointDifference,
                  winnerTeam: score.isWin ? "declarer" : "defenders"
              }]);
          } catch (e) {
              console.error("Scoring error:", e);
          }
      }
      return;
    }
    // ... rest of bot logic

    if (gameState.currentPlayer !== undefined && gameState.currentPlayer !== HUMAN_PLAYER) {
      const currentBot = bots.find(b => b.playerId === gameState.currentPlayer);
      if (!currentBot) return;

      const timer = setTimeout(() => {
        try {
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
                let exchangeCount = 3;
                if (gameState.contract === "dve" || gameState.contract === "solo_dve") exchangeCount = 2;
                if (gameState.contract === "ena" || gameState.contract === "solo_ena") exchangeCount = 1;
                
                const hand = nextState.hands[currentBot.playerId]!;
                const discards = currentBot.chooseDiscards(gameState, hand, exchangeCount);
                nextState = dispatchDiscard(gameState, currentBot.playerId, discards);
              }
              break;
              
            case "announcements":
              nextState = dispatchAnnouncementPass(gameState, currentBot.playerId);
              break;
              
            case "playing":
              const botHandInRound = gameState.trickRound?.hands.find(h => h.playerId === currentBot.playerId)?.cards;
              if (!botHandInRound || botHandInRound.length === 0) return;
              
              const cardToPlay = currentBot.choosePlay(gameState, botHandInRound);
              nextState = dispatchPlay(gameState, currentBot.playerId, cardToPlay);
              
              const nextHands = { ...nextState.hands };
              nextState.trickRound?.hands.forEach(h => {
                nextHands[h.playerId] = h.cards;
              });
              nextState = { ...nextState, hands: nextHands };
              break;
          }

          // Check if trick just completed
          if (gameState.phase === "playing" && nextState.trickRound && 
              nextState.trickRound.capturedTricks.length > (gameState.trickRound?.capturedTricks.length || 0)) {
            
            const newlyCaptured = nextState.trickRound.capturedTricks[nextState.trickRound.capturedTricks.length - 1];
            setLastCapturedTrick(newlyCaptured);
            setIsProcessingTrick(true);
            setIsMovingCards(false); // Show cards static first
            setGameState(nextState);

            // Step 1: Wait 1s so player sees the 4th card
            setTimeout(() => {
              setIsMovingCards(true); // Step 2: Start animation
            }, 1000);

            // Step 3: Finish processing after animation
            setTimeout(() => {
              setIsProcessingTrick(false);
              setIsMovingCards(false);
            }, 2500);
          } else {
            setGameState(nextState);
          }

        } catch (e) {
          console.error("Bot Error:", e);
        }
      }, 700);

      return () => clearTimeout(timer);
    }
  }, [gameState, bots, isProcessingTrick, HUMAN_PLAYER]);

  // Human actions
  const playBid = (action: BiddingAction) => {
    if (!gameState || gameState.phase !== "bidding" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchBid(gameState, HUMAN_PLAYER, action));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const playCall = (suit: "hearts" | "spades" | "clubs" | "diamonds" | undefined) => {
    if (!gameState || gameState.phase !== "calling" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchCall(gameState, HUMAN_PLAYER, suit));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const playTalonPick = (groupIndex: number) => {
    if (!gameState || gameState.phase !== "talon" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      const nextState = dispatchTalonPick(gameState, HUMAN_PLAYER, groupIndex);
      const sortedHands = { ...nextState.hands };
      sortedHands[HUMAN_PLAYER] = sortCards(sortedHands[HUMAN_PLAYER]!);
      setGameState({ ...nextState, hands: sortedHands });
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const playDiscard = (cards: Card[]) => {
    if (!gameState || gameState.phase !== "talon" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchDiscard(gameState, HUMAN_PLAYER, cards));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const playAnnouncementPass = () => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchAnnouncementPass(gameState, HUMAN_PLAYER));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const playCard = (card: Card) => {
    if (!gameState || gameState.phase !== "playing" || gameState.currentPlayer !== HUMAN_PLAYER || isProcessingTrick) return;
    try {
      let nextState = dispatchPlay(gameState, HUMAN_PLAYER, card);
      
      const nextHands = { ...nextState.hands };
      nextState.trickRound?.hands.forEach(h => {
        nextHands[h.playerId] = h.cards;
      });
      nextState = { ...nextState, hands: nextHands };

      if (nextState.trickRound && nextState.trickRound.capturedTricks.length > (gameState.trickRound?.capturedTricks.length || 0)) {
        const newlyCaptured = nextState.trickRound.capturedTricks[nextState.trickRound.capturedTricks.length - 1];
        setLastCapturedTrick(newlyCaptured);
        setIsProcessingTrick(true);
        setIsMovingCards(false);
        setGameState(nextState);

        setTimeout(() => {
          setIsMovingCards(true);
        }, 1000);

        setTimeout(() => {
          setIsProcessingTrick(false);
          setIsMovingCards(false);
        }, 2500);
      } else {
        setGameState(nextState);
      }
    } catch (e) {
      alert("Nelegalna poteza: " + (e as Error).message);
    }
  };

  const playAnnouncement = (type: AnnouncementType) => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchAnnouncement(gameState, HUMAN_PLAYER, type));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return {
    gameState,
    startGame,
    HUMAN_PLAYER,
    playerNames,
    lastCapturedTrick,
    isProcessingTrick,
    isMovingCards,
    currentRound,
    maxRounds: gameSettings?.maxRounds || 0,
    history,
    roundScore,
    nextRound,
    playBid,
    playCall,
    playTalonPick,
    playDiscard,
    playAnnouncement,
    playAnnouncementPass,
    playCard
  };
}