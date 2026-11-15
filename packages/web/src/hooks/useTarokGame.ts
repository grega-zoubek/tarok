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
  dispatchRaiseToBarvniValat,
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
  settleGame,
  getLegalBidsForState,
  getExchangeCount,
  PASS,
  type GameScoreResult,
  type AnnouncementType,
  type ContraTarget,
} from "@tarok/engine";
import { HeuristicBot, type BotDifficulty } from "@tarok/ai";
import {
  parseSession,
  serializeSession,
  SESSION_STORAGE_KEY,
} from "../lib/session";

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
  const [currentSeed, setCurrentSeed] = useState<number | null>(null);
  const [gameSettings, setGameSettings] = useState<GameSettings | null>(null);
  const [history, setHistory] = useState<RoundResult[]>([]);
  const [roundScore, setRoundScore] = useState<GameScoreResult | null>(null);
  // Radlci po igralcu: indeks 0 = human, 1-3 = boti
  const [playerRadlci, setPlayerRadlci] = useState<number[]>([0, 0, 0, 0]);
  // Kumulativne točke po igralcu
  const [playerScores, setPlayerScores] = useState<number[]>([0, 0, 0, 0]);
  // Napaka za prikaz v UI
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  // Naslednji krog je obvezni klop (točno 0 točk ali po delitvi brez taroka)
  const pendingCompulsoryKlopRef = useRef(false);

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


  // Initialize game
  const startGame = (settings: GameSettings) => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    pendingCompulsoryKlopRef.current = false;
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

    // Obvezni klop iz prejšnjega kroga (točno 0 točk) ali po delitvi brez taroka
    let compulsoryKlop = pendingCompulsoryKlopRef.current;
    pendingCompulsoryKlopRef.current = false;

    // »Brez taroka ni taroka« — eno ponovno deljenje sproži obvezni klop
    let dealResult;
    let attempts = 0;
    let usedSeed: number;
    do {
      let deck = createTarokDeck();
      const randomSeed = Math.floor(Math.random() * 1000000) + attempts;
      usedSeed = randomSeed;
      deck = shuffle(deck, createSeededRng(randomSeed));
      dealResult = deal(deck, { playerCount: 4 });
      if (anyHandMissingTarok(dealResult.hands)) {
        compulsoryKlop = true;
      }
      attempts += 1;
    } while (anyHandMissingTarok(dealResult.hands) && attempts < 50);
    setCurrentSeed(usedSeed);

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
      compulsoryKlop,
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

  // ── Session-storage persistence ─────────────────────────────────────────
  // On mount, check for a saved session and resume it.
  useEffect(() => {
    const saved = parseSession(sessionStorage.getItem(SESSION_STORAGE_KEY));
    if (!saved) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    setGameSettings(saved.settings);
    setCurrentRound(saved.round);
    if (saved.seed !== null) setCurrentSeed(saved.seed);
    setHistory(saved.history);
    setPlayerScores(saved.scores);
    setPlayerRadlci(saved.radlci);
    setRoundScore(saved.roundScore);

    setBots(
      saved.settings.botConfigs.map(
        (config, index) => new HeuristicBot((index + 1) as PlayerId, config.difficulty),
      ),
    );
    setPlayerNames([
      saved.settings.humanName,
      ...saved.settings.botConfigs.map((b) => b.name),
    ]);

    // Nadaljujemo točno tam, kjer smo ostali (brez ponovnega deljenja in
    // brez ponovnega obračuna že končanega kroga). Stara shramba brez
    // stanja začne krog znova z istimi nastavitvami.
    if (saved.state) {
      // Obvezni klop se določi ob obračunu; po obnovitvi že obračunanega
      // kroga ga izpeljemo iz zadnjega zapisa v zgodovini.
      const lastResult = saved.history[saved.history.length - 1];
      if (saved.roundScore && lastResult) {
        pendingCompulsoryKlopRef.current = saved.scores.some(
          (score, i) => score === 0 && (lastResult.perPlayerDelta[i] ?? 0) !== 0,
        );
      }
      setGameState(saved.state);
    } else {
      startNewRound(saved.settings, saved.round);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist session whenever settings / round / history / scores change.
  useEffect(() => {
    if (!gameSettings) return;
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        serializeSession({
          settings: gameSettings,
          round: currentRound,
          history,
          scores: playerScores,
          radlci: playerRadlci,
          seed: currentSeed,
          state: gameState,
          roundScore,
        })
      );
    } catch { /* storage full or blocked */ }
  }, [gameSettings, currentRound, history, playerScores, playerRadlci, currentSeed, gameState, roundScore]);
  // ────────────────────────────────────────────────────────────────────────

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
              if (bid !== PASS && !getLegalBidsForState(gameState).includes(bid)) {
                bid = PASS;
              }
              nextState = dispatchBid(gameState, currentBot.playerId, bid);
              break;
            }
              
            case "calling": {
              const suit = currentBot.chooseCalledKing(gameState);
              nextState = dispatchCall(gameState, currentBot.playerId, suit);
              break;
            }
              
            case "talon":
              if (gameState.pickedTalonGroupIndex === undefined) {
                const groupIndex = currentBot.chooseTalonGroup(gameState);
                nextState = dispatchTalonPick(gameState, currentBot.playerId, groupIndex);
              } else {
                const exchangeCount = getExchangeCount(gameState.contract);

                const hand = nextState.hands[currentBot.playerId]!;
                const discards = currentBot.chooseDiscards(gameState, hand, exchangeCount);
                nextState = dispatchDiscard(gameState, currentBot.playerId, discards);
              }
              break;

            case "raising": {
              const raise = currentBot.chooseRaiseToBarvniValat?.(gameState) ?? false;
              nextState = dispatchRaiseToBarvniValat(gameState, currentBot.playerId, raise);
              break;
            }
              
            case "announcements": {
              let annState = gameState;
              const contra = currentBot.chooseContra?.(annState);
              if (contra) {
                try {
                  annState = dispatchContra(annState, currentBot.playerId, contra);
                } catch {
                  // Kontra morda ni več veljavna
                }
              }
              const anns = currentBot.chooseAnnouncements(annState);
              for (const ann of anns) {
                try {
                  annState = dispatchAnnouncement(annState, currentBot.playerId, ann);
                } catch {
                  // Napoved morda ni dovoljena — preskoči
                }
              }
              nextState = dispatchAnnouncementPass(annState, currentBot.playerId);
              break;
            }
              
            case "playing": {
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
          setErrorMessage("Napaka bota: " + (e as Error).message);
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
        // Obračun (točke po igralcih in radlci) je v celoti v pogonu.
        const settlement = settleGame(gameState, {
          radlci: Object.fromEntries(playerRadlci.map((r, i) => [i, r])),
        });
        const score = settlement.score;
        const radlciUsed = settlement.radlciUsed;
        const perPlayerDelta = gameState.playerOrder.map(
          (pid) => settlement.perPlayerDelta[pid] ?? 0,
        );
        // Klop nima skupne vrednosti igre; v zgodovini pokažemo izid človeka.
        const roundFinalValue =
          gameState.contract === "klop"
            ? (perPlayerDelta[HUMAN_PLAYER] ?? 0)
            : settlement.finalValue;

        setPlayerRadlci(
          gameState.playerOrder.map((pid) => settlement.radlciAfter[pid] ?? 0),
        );

        // Posodobi kumulativne točke; kdor s tem krogom pristane točno na 0,
        // sproži obvezni klop v naslednjem krogu.
        setPlayerScores(prev => {
          const next = prev.map((s, i) => s + (perPlayerDelta[i] ?? 0));
          if (next.some((s, i) => s === 0 && (perPlayerDelta[i] ?? 0) !== 0)) {
            pendingCompulsoryKlopRef.current = true;
          }
          return next;
        });

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
        setErrorMessage("Napaka pri obračunu: " + (e as Error).message);
      }
    }, 3000);

    return () => clearTimeout(t);
  }, [gameState, roundScore, playerRadlci, playerNames, currentRound, HUMAN_PLAYER]);

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

  const playRaise = (raise: boolean) => {
    if (!gameState || gameState.phase !== "raising" || gameState.currentPlayer !== HUMAN_PLAYER) return;
    try {
      setGameState(dispatchRaiseToBarvniValat(gameState, HUMAN_PLAYER, raise));
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
    playRaise,
    playAnnouncement,
    playAnnouncementPass,
    playContra,
    playCard,
    errorMessage,
    clearError: () => setErrorMessage(null)
  };
}