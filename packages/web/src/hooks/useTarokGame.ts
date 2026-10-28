import { useState, useEffect, useCallback, useRef } from "react";
import { 
  type GameState, 
  createTarokDeck, 
  shuffle, 
  deal, 
  anyHandMissingTarok,
  createInitialGameState, 
  type PlayerId, 
  createSeededRng,
  dispatchBid,
  dispatchCall,
  dispatchTalonPick,
  dispatchDiscard,
  dispatchAnnouncement,
  dispatchAnnouncementPass,
  dispatchContra,
  dispatchPlay,
  type BiddingAction,
  type Card,
  isTarokCard,
  tarokStrength,
  isSuitCard,
  suitStrength,
  calculateGameScore,
  applyRadlci,
  isLegalBid,
  PASS,
  type Bid,
  type GameScoreResult,
  type AnnouncementType,
  type ContraTarget,
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
  razlika: number;           // zaokrožena razlika točk
  valueBeforeRadlci: number; // contractValue + bonusValue
  finalValue: number;        // po aplikaciji radlcev
  radlciUsed: number;        // koliko radlcev je bilo porabljenih
  mondfang: number;          // 0 ali −21
  mondfangPlayerId: number | undefined; // kdo ga je izgubil
  newRadlciEarned: number;   // koliko novih radlcev so dobili
  winnerTeam: "declarer" | "defenders" | "klop";
  /** Delta točk tega kroga za vsakega igralca (index = playerId) */
  perPlayerDelta: number[];
  // Klop-specifično
  klopPlayerPoints?: Record<number, number> | undefined;
  klopWinners?: number[] | undefined;
  klopLosers?: number[] | undefined;
}

export function useTarokGame() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [bots, setBots] = useState<HeuristicBot[]>([]);
  const [playerNames, setPlayerNames] = useState<string[]>([]);
  const [lastCapturedTrick, setLastCapturedTrick] = useState<any>(null);
  const [isProcessingTrick, setIsProcessingTrick] = useState(false);
  const [isMovingCards, setIsMovingCards] = useState(false);
  const [showKlopTalon, setShowKlopTalon] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [roundScore, setRoundScore] = useState<GameScoreResult | null>(null);
  // Radlci po igralcu: indeks 0 = human, 1-3 = boti
  const [playerRadlci, setPlayerRadlci] = useState<number[]>([0, 0, 0, 0]);
  // Kumulativne točke po igralcu
  const [playerScores, setPlayerScores] = useState<number[]>([0, 0, 0, 0]);
  // Napaka za prikaz v UI
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tracks pending trick-animation timers so we can cancel them on round reset
  const trickTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // Guards against scheduling the delayed final-score timeout more than once
  const scoringScheduledRef = useRef(false);

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

  // ── Session-storage persistence ─────────────────────────────────────────
  // On mount, check for a saved session and resume it.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tarokSession");
      if (saved) {
        const { settings, round, hist, scores, radlci: savedRadlci } = JSON.parse(saved) as {
          settings: GameSettings;
          round: number;
          hist: RoundResult[];
          scores: number[];
          radlci: number[];
        };
        setGameSettings(settings);
        setCurrentRound(round);
        setHistory(hist);
        if (scores) setPlayerScores(scores);
        if (savedRadlci) setPlayerRadlci(savedRadlci);
        
        // Ob refreshu ne dealamo novih kart ampak samo nastavimo settings
        // restart igre od začetka trenutnega kroga je najboljši približek
        startNewRound(settings, round);
      }
    } catch {
      sessionStorage.removeItem("tarokSession");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps4
  }, []);

  // Persist session whenever settings / round / history / scores change.
  useEffect(() => {
    if (!gameSettings) return;
    try {
      sessionStorage.setItem(
        "tarokSession",
        JSON.stringify({
          settings: gameSettings,
          round: currentRound,
          hist: history,
          scores: playerScores,
          radlci: playerRadlci,
        })
      );
    } catch { /* storage full or blocked */ }
  }, [gameSettings, currentRound, history, playerScores, playerRadlci]);
  // ────────────────────────────────────────────────────────────────────────

  // Initialize game
  const startGame = (settings: GameSettings) => {
    sessionStorage.removeItem("tarokSession");
    setGameSettings(settings);
    setCurrentRound(1);
    setHistory([]);
    setRoundScore(null);
    setPlayerRadlci([0, 0, 0, 0]);
    setPlayerScores([0, 0, 0, 0]);
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
    // Cancel any pending trick-animation timers from the previous round
    trickTimersRef.current.forEach(clearTimeout);
    trickTimersRef.current = [];
    scoringScheduledRef.current = false;

    // »Brez taroka ni taroka« — ponovno deli, dokler ima vsak vsaj en tarok
    let dealResult;
    let attempts = 0;
    do {
      let deck = createTarokDeck();
      const randomSeed = Math.floor(Math.random() * 1000000) + attempts;
      deck = shuffle(deck, createSeededRng(randomSeed));
      dealResult = deal(deck, { playerCount: 4 });
      attempts += 1;
    } while (anyHandMissingTarok(dealResult.hands) && attempts < 50);

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
    // Reset animation state BEFORE setting new game state so the effect
    // sees isProcessingTrick=false and immediately runs bot turns.
    setLastCapturedTrick(null);
    setIsProcessingTrick(false);
    setIsMovingCards(false);
    setShowKlopTalon(false);
    setGameState(newState);
  };

  // Basic game loop hook for bot actions
  useEffect(() => {
    if (!gameState || gameState.phase === "finished" || isProcessingTrick) {
      return;
    }
    // ... rest of bot logic

    if (gameState.currentPlayer !== undefined && gameState.currentPlayer !== HUMAN_PLAYER) {
      const currentBot = bots.find(b => b.playerId === gameState.currentPlayer);
      if (!currentBot) return;

      // Talon faza:
      //  - Prvi korak (pobiranje kupčka): 3 sekunde.
      //  - Drugi korak (odvržene karte): povečamo pavzo, da so izbrane
      //    talon karte vidne še 4 sekunde dlje → 3s + 4s = 7s.
      const botDelay = gameState.phase === "talon"
        ? (gameState.pickedTalonGroupIndex === undefined ? 3000 : 7000)
        : 700;

      const timer = setTimeout(() => {
        try {
          let nextState = gameState;
          
          switch (gameState.phase) {
            case "bidding": {
              let bid = currentBot.chooseBid(gameState);
              // Preverimo legalnost pred dispatchom — bot morda vrne poteze ki ni več veljavna
              if (bid !== PASS) {
                const mockRound = {
                  playerOrder: gameState.playerOrder,
                  forehand: gameState.forehand,
                  currentPlayerIndex: gameState.playerOrder.indexOf(currentBot.playerId),
                  bids: gameState.bids,
                  passedPlayers: gameState.passedPlayers,
                  currentHighestBid: gameState.contract && gameState.contract !== "klop"
                    ? { playerId: gameState.declarer!, bid: gameState.contract as Bid }
                    : undefined,
                  isFinished: false,
                };
                if (!isLegalBid(mockRound, currentBot.playerId, bid as Bid)) {
                  bid = PASS;
                }
              }
              nextState = dispatchBid(gameState, currentBot.playerId, bid);
              break;
            }
              
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
            setIsMovingCards(false); 
            setShowKlopTalon(false);
            setGameState(nextState);

            const isKlopTalonTrick = nextState.contract === "klop" && (nextState.trickRound.capturedTricks.length <= 6);
            const isLastTrick = nextState.phase === "finished";

            if (isKlopTalonTrick) {
              // 1. 4 karte na mizi ustavljene.
              // 2. Po 500ms prileti talon karta.
              // 3. Po 1500ms vse skupaj odleti.
              const t1 = setTimeout(() => setShowKlopTalon(true), 500);
              const t2 = setTimeout(() => setIsMovingCards(true), 2000); 
              const t3 = setTimeout(() => {
                setIsProcessingTrick(false);
                setIsMovingCards(false);
                setShowKlopTalon(false);
              }, 3500);
              trickTimersRef.current = [t1, t2, t3];
            } else {
              // Navaden štih: 1.5s pavza, potem fly-away.
              // Zadnji štih: 3s pavza (po tvoji želji), potem fly-away.
              const staticHold = isLastTrick ? 3000 : 1500;
              const t1 = setTimeout(() => setIsMovingCards(true), staticHold);
              const t2 = setTimeout(() => {
                setIsProcessingTrick(false);
                setIsMovingCards(false);
              }, staticHold + 1500);
              trickTimersRef.current = [t1, t2];
            }
          } else {
            setGameState(nextState);
          }

        } catch (e) {
          console.error("Bot Error:", e);
        }
      }, botDelay);

      return () => clearTimeout(timer);
    }
  }, [gameState, bots, isProcessingTrick, HUMAN_PLAYER, roundScore, playerRadlci, currentRound, playerNames]);

  // ── Delayed final-round scoring ────────────────────────────────────────
  // Ko se igra zaključi, počakamo ~3 sekunde, da igralec vidi zadnjo padlo
  // karto (zadnji štih), ŠELE nato prikažemo rezultat kroga (roundScore).
  // Brez te pavze bi overlay rezultata takoj prekril tabelo in 4. karta
  // zadnjega štiha ne bi bila vidna.
  useEffect(() => {
    if (!gameState || gameState.phase !== "finished" || roundScore) return;
    if (scoringScheduledRef.current) return;

    scoringScheduledRef.current = true;

    const t = setTimeout(() => {
      scoringScheduledRef.current = false;
      try {
        const score = calculateGameScore(gameState);

        // Radlci aktivne ekipe (deklarant + partner)
        const declarerTeam = gameState.teams?.declarerTeam ?? [];
        const declarerRadlciCount = declarerTeam.reduce(
          (max, pid) => Math.max(max, playerRadlci[pid] ?? 0), 0
        );

        // Klop ima posebno logiko radlcev
        let finalValue: number;
        let radlciUsed: number;

        if (gameState.contract === "klop") {
          finalValue = 0; // klop se prikazuje drugače
          radlciUsed = 0;
        } else {
          const applied = applyRadlci(score.totalBeforeRadlci, declarerRadlciCount);
          finalValue = applied.finalValue;
          radlciUsed = applied.radlciUsed;
        }

        // Posodobi radlce:
        // - Aktivni: če zmaga, porabi radlce (reset na 0); sicer ohrani
        // - Vsi: dobijo +newRadlciEarned
        setPlayerRadlci(prev => {
          const next = [...prev];
          for (let i = 0; i < next.length; i++) {
            next[i] = (next[i] ?? 0) + score.newRadlciEarned;
          }
          if (gameState.contract === "klop") {
            for (const winnerId of (score.klopWinners ?? [])) {
              next[winnerId] = 0;
            }
          } else {
            if (score.isWin && radlciUsed > 0) {
              for (const pid of declarerTeam) {
                next[pid] = 0;
              }
            }
          }
          return next;
        });

        // ── Delta točk za vsakega igralca ────────────────────────────────
        const perPlayerDelta = [0, 0, 0, 0];
        let roundFinalValue = finalValue;

        if (gameState.contract === "klop") {
          for (const pid of gameState.playerOrder) {
            const isWinner = score.klopWinners?.includes(pid);
            const isLoser = score.klopLosers?.includes(pid);
            let base: number;
            if (isWinner) {
              base = 70;
            } else if (isLoser) {
              base = -70;
            } else {
              base = -(score.klopPlayerPoints?.[pid] ?? 0);
            }
            const ownRadlc = playerRadlci[pid] ?? 0;
            perPlayerDelta[pid] = base * Math.pow(2, ownRadlc);
          }
          roundFinalValue = perPlayerDelta[0] ?? 0;
        } else {
          const declarerTeamIds = new Set(gameState.teams?.declarerTeam ?? []);
          const defendingTeamIds = new Set(gameState.teams?.defendingTeam ?? []);
          const declarerWon = score.isWin;

          for (const pid of gameState.playerOrder) {
            if (declarerTeamIds.has(pid)) {
              perPlayerDelta[pid] = roundFinalValue;
            } else if (defendingTeamIds.has(pid)) {
              perPlayerDelta[pid] = declarerWon ? 0 : -roundFinalValue;
            }
          }
        }

        // Dodaj Mondfang kazen tistemu, ki ga je izgubil
        if (score.mondfang < 0 && score.mondfangPlayerId !== undefined) {
          perPlayerDelta[score.mondfangPlayerId] += score.mondfang; // -21
        }

        // Posodobi kumulativne točke
        setPlayerScores(prev => prev.map((s, i) => s + (perPlayerDelta[i] ?? 0)));

        setRoundScore(score);
        setHistory(prev => [...prev, {
          round: currentRound,
          contract: gameState.contract || "klop",
          declarer: gameState.declarer !== undefined ? playerNames[gameState.declarer]! : "Nihče",
          razlika: score.razlika,
          valueBeforeRadlci: score.totalBeforeRadlci,
          finalValue: roundFinalValue,
          radlciUsed,
          mondfang: score.mondfang,
          mondfangPlayerId: score.mondfangPlayerId,
          newRadlciEarned: score.newRadlciEarned,
          winnerTeam: gameState.contract === "klop" ? "klop" : score.isWin ? "declarer" : "defenders",
          perPlayerDelta,
          klopPlayerPoints: score.klopPlayerPoints,
          klopWinners: score.klopWinners,
          klopLosers: score.klopLosers,
        }]);
      } catch (e) {
        console.error("Scoring error:", e);
      }
    }, 3000);

    return () => clearTimeout(t);
  }, [gameState, roundScore, playerRadlci, playerNames, currentRound]);

  // Human actions
  const playBid = (action: BiddingAction) => {
    if (!gameState || gameState.phase !== "bidding" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchBid(gameState, HUMAN_PLAYER, action));
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  const playCall = (suit: "hearts" | "spades" | "clubs" | "diamonds" | undefined) => {
    if (!gameState || gameState.phase !== "calling" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchCall(gameState, HUMAN_PLAYER, suit));
    } catch (e) {
      setErrorMessage((e as Error).message);
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
      setErrorMessage((e as Error).message);
    }
  };

  const playDiscard = (cards: Card[]) => {
    if (!gameState || gameState.phase !== "talon" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchDiscard(gameState, HUMAN_PLAYER, cards));
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  const playAnnouncementPass = () => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchAnnouncementPass(gameState, HUMAN_PLAYER));
    } catch (e) {
      setErrorMessage((e as Error).message);
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
        setShowKlopTalon(false);
        setGameState(nextState);

        const isKlopTalonTrick = nextState.contract === "klop" && (nextState.trickRound.capturedTricks.length <= 6);
        const isLastTrick = nextState.phase === "finished";

        if (isKlopTalonTrick) {
          const t1 = setTimeout(() => setShowKlopTalon(true), 500);
          const t2 = setTimeout(() => setIsMovingCards(true), 2000); 
          const t3 = setTimeout(() => {
            setIsProcessingTrick(false);
            setIsMovingCards(false);
            setShowKlopTalon(false);
          }, 3500);
          trickTimersRef.current = [t1, t2, t3];
        } else {
          const staticHold = isLastTrick ? 3000 : 1500;
          const t1 = setTimeout(() => setIsMovingCards(true), staticHold);
          const t2 = setTimeout(() => {
            setIsProcessingTrick(false);
            setIsMovingCards(false);
          }, staticHold + 1500);
          trickTimersRef.current = [t1, t2];
        }
      } else {
        setGameState(nextState);
      }
    } catch (e) {
      setErrorMessage("Nelegalna poteza: " + (e as Error).message);
    }
  };

  const playAnnouncement = (type: AnnouncementType) => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchAnnouncement(gameState, HUMAN_PLAYER, type));
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  const playContra = (target: ContraTarget) => {
    if (!gameState || gameState.phase !== "announcements" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchContra(gameState, HUMAN_PLAYER, target));
    } catch (e) {
      setErrorMessage((e as Error).message);
    }
  };

  return {
    gameState,
    startGame,
    HUMAN_PLAYER,
    playerNames,
    playerRadlci,
    playerScores,
    lastCapturedTrick,
    isProcessingTrick,
    isMovingCards,
    showKlopTalon,
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
    playContra,
    playCard,
    errorMessage,
    clearError: () => setErrorMessage(null)
  };
}