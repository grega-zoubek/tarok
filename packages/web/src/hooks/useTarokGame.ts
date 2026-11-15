import { useState, useEffect, useCallback, useRef } from "react";
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
  getAnnouncementError,
  getLegalBidsForState,
  PASS,
  type GameScoreResult,
  type AnnouncementType,
  type CapturedTrick,
  settleGame,
  getExchangeCount,
  getHand,
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
  const [lastCapturedTrick, setLastCapturedTrick] = useState<CapturedTrick | null>(null);
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

    const restoredBots = saved.settings.botConfigs.map(
      (config, index) => new HeuristicBot((index + 1) as PlayerId, config.difficulty)
    );
    setBots(restoredBots);
    setPlayerNames([
      saved.settings.humanName,
      ...saved.settings.botConfigs.map((b) => b.name),
    ]);

    // Nadaljujemo točno tam, kjer smo ostali; stara shramba brez stanja
    // pa začne krog znova (z istimi nastavitvami).
    if (saved.state) {
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

  // Initialize game
  const startGame = (settings: GameSettings) => {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
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

    // Naključni seed iz kriptografskega vira (z fallbackom za stare brskalnike).
    const randomSeed = (() => {
      const cryptoApi = globalThis.crypto;
      if (cryptoApi?.getRandomValues) {
        const buffer = new Uint32Array(1);
        cryptoApi.getRandomValues(buffer);
        return buffer[0]! % 1_000_000;
      }
      return Math.floor(Math.random() * 1_000_000);
    })();

    // Pravilo "brez taroka ni taroka": vsak igralec mora imeti vsaj en tarok,
    // sicer karte ponovno premešamo in razdelimo.
    let seed = randomSeed;
    let dealResult: ReturnType<typeof deal>;
    for (;;) {
      const deck = shuffle(createTarokDeck(), createSeededRng(seed));
      dealResult = deal(deck, { playerCount: 4 });
      const everyoneHasTarok = dealResult.hands.every((hand) =>
        hand.some(isTarokCard),
      );
      if (everyoneHasTarok) break;
      seed = (seed * 1664525 + 1013904223) >>> 0;
    }
    setCurrentSeed(seed);

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

  // Počisti vse animacijske timerje ob unmountu.
  useEffect(() => {
    return () => {
      trickTimersRef.current.forEach(clearTimeout);
      trickTimersRef.current = [];
    };
  }, []);

  /**
   * Skupna obdelava napredka štiha za bota in človeka: zazna nov zaključen
   * štih, nastavi animacijo in šele nato preda novo stanje UI.
   */
  const applyTrickProgress = useCallback(
    (prevState: GameState, nextState: GameState) => {
      const before = prevState.trickRound?.capturedTricks.length ?? 0;
      const capturedCount = nextState.trickRound?.capturedTricks.length ?? 0;

      if (prevState.phase !== "playing" || !nextState.trickRound || capturedCount <= before) {
        setGameState(nextState);
        return;
      }

      const newlyCaptured = nextState.trickRound.capturedTricks[capturedCount - 1] ?? null;
      setLastCapturedTrick(newlyCaptured);
      setIsProcessingTrick(true);
      setIsMovingCards(false);
      setShowKlopTalon(false);
      setGameState(nextState);

      const isKlopTalonTrick = nextState.contract === "klop" && capturedCount <= 6;
      const isLastTrick = nextState.phase === "finished";

      // Prejšnji timerji ne smejo več vplivati na novo stanje.
      trickTimersRef.current.forEach(clearTimeout);

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
    },
    []
  );

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
              // Preverimo legalnost pred dispatchom — bot morda vrne potezo, ki ni veljavna.
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
                const hand = getHand(gameState, currentBot.playerId);
                const discards = currentBot.chooseDiscards(gameState, hand, exchangeCount);
                nextState = dispatchDiscard(gameState, currentBot.playerId, discards);
              }
              break;
              
            case "announcements": {
              const announcement = currentBot
                .chooseAnnouncements(gameState)
                .find(
                  (type) =>
                    getAnnouncementError(gameState, currentBot.playerId, type) === undefined,
                );
              nextState = announcement !== undefined
                ? dispatchAnnouncement(gameState, currentBot.playerId, announcement)
                : dispatchAnnouncementPass(gameState, currentBot.playerId);
              break;
            }
              
            case "playing": {
              const botHand = getHand(gameState, currentBot.playerId);
              if (botHand.length === 0) return;
              const cardToPlay = currentBot.choosePlay(gameState, botHand);
              nextState = dispatchPlay(gameState, currentBot.playerId, cardToPlay);
              break;
            }
          }

          applyTrickProgress(gameState, nextState);
        } catch (e) {
          console.error("Bot Error:", e);
        }
      }, botDelay);

      return () => clearTimeout(timer);
    }
  }, [gameState, bots, isProcessingTrick, HUMAN_PLAYER, roundScore, playerRadlci, currentRound, playerNames, applyTrickProgress]);

  // ── Delayed final-round scoring ────────────────────────────────────────
  // Ko se igra zaključi, počakamo ~3 sekunde, da igralec vidi zadnjo padlo
  // karto (zadnji štih), ŠELE nato prikažemo rezultat kroga (roundScore).
  // Brez te pavze bi overlay rezultata takoj prekril tabelo in 4. karta
  // zadnjega štiha ne bi bila vidna.
  useEffect(() => {
    if (!gameState || gameState.phase !== "finished" || roundScore) return;
    // Obnovljena seja brez shranjenega rezultata (starejši zapis) je krog
    // že obračunala — prepreči podvojen obračun in podvojene točke.
    if (history.some((result) => result.round === currentRound)) return;
    if (scoringScheduledRef.current) return;

    scoringScheduledRef.current = true;

    const t = setTimeout(() => {
      scoringScheduledRef.current = false;
      try {
        // Ves obračun (vključno z radlci in mondfangom) opravi engine.
        const settlement = settleGame(gameState, {
          radlci: Object.fromEntries(
            playerRadlci.map((value, index) => [index, value])
          ),
        });
        const score = settlement.score;
        const perPlayerDelta = gameState.playerOrder.map(
          (pid) => settlement.perPlayerDelta[pid] ?? 0
        );

        setPlayerRadlci((prev) =>
          prev.map((_, index) => settlement.radlciAfter[index] ?? 0)
        );
        setPlayerScores((prev) =>
          prev.map((value, index) => value + (settlement.perPlayerDelta[index] ?? 0))
        );

        setRoundScore(score);
        setHistory(prev => [...prev, {
          round: currentRound,
          contract: gameState.contract || "klop",
          declarer: gameState.declarer !== undefined ? playerNames[gameState.declarer]! : "Nihče",
          razlika: score.razlika,
          valueBeforeRadlci: score.totalBeforeRadlci,
          finalValue: settlement.finalValue,
          radlciUsed: settlement.radlciUsed,
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
  }, [gameState, roundScore, playerRadlci, playerNames, currentRound, history]);

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
      applyTrickProgress(gameState, dispatchPlay(gameState, HUMAN_PLAYER, card));
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
    currentSeed,
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
    playCard,
    errorMessage,
    clearError: () => setErrorMessage(null)
  };
}