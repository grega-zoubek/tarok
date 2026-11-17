import { useState, useEffect, useCallback, useRef, useReducer } from "react";
import {
  type CapturedTrick,
  type PlayerId,
  type BiddingAction,
  type Card,
  type GameAction,
  type AnnouncementType,
  type ContraTarget,
  type Suit,
} from "@tarok/engine";
import type { BotDifficulty } from "@tarok/ai";
import { parseSession, serializeSession, SESSION_STORAGE_KEY } from "../lib/session";
import { chooseBotTurn, createRound, sessionReducer, type SessionModel } from "../lib/gameSession";

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
  razlika: number;
  valueBeforeRadlci: number;
  finalValue: number;
  radlciUsed: number;
  mondfang: number;
  mondfangPlayerId: number | undefined;
  newRadlciEarned: number;
  winnerTeam: "declarer" | "defenders" | "klop";
  perPlayerDelta: number[];
  klopPlayerPoints?: Record<number, number> | undefined;
  klopWinners?: number[] | undefined;
  klopLosers?: number[] | undefined;
}
const HUMAN_PLAYER: PlayerId = 0;
const randomSeed = () => Math.floor(Math.random() * 0x100000000);
const RECOVERY_MESSAGE = "Shranjena igra je poškodovana ali nezdružljiva. Začni novo igro.";

function restore(): SessionModel {
  try {
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return { session: null, error: null };
    const saved = parseSession(raw);
    if (!saved) return { session: null, error: RECOVERY_MESSAGE };
    if (!saved.state)
      return { session: createRound(saved, saved.round, saved.seed ?? randomSeed()), error: null };
    // Old sessions did not store the pending flag explicitly.
    if (saved.pendingCompulsoryKlop === undefined && saved.roundScore) {
      const last = saved.history.find((r) => r.round === saved.round);
      saved.pendingCompulsoryKlop = saved.scores.some(
        (s, i) => s === 0 && (last?.perPlayerDelta[i] ?? 0) !== 0,
      );
    }
    return { session: saved, error: null };
  } catch {
    return {
      session: null,
      error: "Shramba brskalnika ni dostopna. Igro lahko nadaljuješ brez shranjevanja.",
    };
  }
}
interface Animation {
  round: number;
  trick: CapturedTrick;
  final: boolean;
  klop: boolean;
}

export function useTarokGame() {
  const [model, dispatch] = useReducer(sessionReducer, undefined, restore);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [animation, setAnimation] = useState<Animation | null>(null);
  const [isMovingCards, setIsMovingCards] = useState(false);
  const [showKlopTalon, setShowKlopTalon] = useState(false);
  const session = model.session;
  const gameState = session?.state ?? null;
  const currentRound = session?.round ?? 1;
  const capturedCount = gameState?.trickRound?.capturedTricks.length ?? 0;
  const previous = useRef({ round: currentRound, count: capturedCount });
  const isProcessingTrick = animation !== null && animation.round === currentRound;

  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(SESSION_STORAGE_KEY, serializeSession(session));
      setStorageWarning(null);
    } catch {
      setStorageWarning("Igre ni mogoče shraniti. Ob osvežitvi bo trenutni napredek izgubljen.");
    }
  }, [session]);

  // Both human and bot actions use the same capture/animation lifecycle.
  useEffect(() => {
    if (previous.current.round !== currentRound || !gameState) {
      previous.current = { round: currentRound, count: capturedCount };
      setAnimation(null);
      setIsMovingCards(false);
      setShowKlopTalon(false);
      return;
    }
    if (capturedCount > previous.current.count && gameState.trickRound) {
      const trick = gameState.trickRound.capturedTricks[capturedCount - 1]!;
      setAnimation({
        round: currentRound,
        trick,
        final: gameState.phase === "finished",
        klop: gameState.contract === "klop" && capturedCount <= 6,
      });
      setIsMovingCards(false);
      setShowKlopTalon(false);
    }
    previous.current = { round: currentRound, count: capturedCount };
  }, [gameState, capturedCount, currentRound]);

  useEffect(() => {
    if (!animation || animation.round !== currentRound) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (animation.klop) timers.push(setTimeout(() => setShowKlopTalon(true), 500));
    const hold = animation.klop ? 2000 : animation.final ? 3000 : 1500;
    timers.push(setTimeout(() => setIsMovingCards(true), hold));
    timers.push(
      setTimeout(() => {
        setAnimation(null);
        setIsMovingCards(false);
        setShowKlopTalon(false);
      }, hold + 1500),
    );
    return () => timers.forEach(clearTimeout);
  }, [animation, currentRound]);

  useEffect(() => {
    if (
      !session ||
      !gameState ||
      model.error ||
      isProcessingTrick ||
      gameState.phase === "finished" ||
      gameState.currentPlayer === undefined ||
      gameState.currentPlayer === HUMAN_PLAYER
    )
      return;
    const delay =
      gameState.phase === "talon"
        ? gameState.pickedTalonGroupIndex === undefined
          ? 3000
          : 7000
        : 700;
    const timer = setTimeout(() => {
      try {
        dispatch({ type: "apply", expected: gameState, ...chooseBotTurn(session) });
      } catch (error) {
        dispatch({
          type: "error",
          message: "Napaka bota: " + (error instanceof Error ? error.message : String(error)),
        });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [session, gameState, isProcessingTrick, model.error]);

  useEffect(() => {
    if (!gameState || gameState.phase !== "finished" || session?.roundScore || model.error) return;
    const timer = setTimeout(() => dispatch({ type: "settle", expected: gameState }), 3000);
    return () => clearTimeout(timer);
  }, [gameState, session?.roundScore, model.error]);

  const act = useCallback(
    (action: GameAction): boolean => {
      if (
        !gameState ||
        model.error ||
        gameState.currentPlayer !== HUMAN_PLAYER ||
        isProcessingTrick
      )
        return false;
      dispatch({ type: "apply", expected: gameState, actions: [action] });
      return true;
    },
    [gameState, isProcessingTrick, model.error],
  );
  const quitGame = () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* Play without storage. */
    }
    dispatch({ type: "quit" });
  };
  return {
    gameState,
    HUMAN_PLAYER,
    startGame: (settings: GameSettings) =>
      dispatch({ type: "start", settings, seed: randomSeed() }),
    quitGame,
    playerNames: session
      ? [session.settings.humanName, ...session.settings.botConfigs.map((b) => b.name)]
      : [],
    playerRadlci: session?.radlci ?? [0, 0, 0, 0],
    playerScores: session?.scores ?? [0, 0, 0, 0],
    lastCapturedTrick: animation?.trick ?? null,
    isProcessingTrick,
    isMovingCards,
    showKlopTalon,
    currentRound,
    maxRounds: session?.settings.maxRounds ?? 0,
    history: session?.history ?? [],
    roundScore: session?.roundScore ?? null,
    nextRound: () => dispatch({ type: "next", seed: randomSeed() }),
    playBid: (action: BiddingAction) => act({ type: "bid", playerId: HUMAN_PLAYER, action }),
    playCall: (suit: Suit | undefined) => act({ type: "call", playerId: HUMAN_PLAYER, suit }),
    playTalonPick: (groupIndex: number) =>
      act({ type: "talonPick", playerId: HUMAN_PLAYER, groupIndex }),
    playDiscard: (cards: Card[]) => act({ type: "discard", playerId: HUMAN_PLAYER, cards }),
    playRaise: (raise: boolean) => act({ type: "raise", playerId: HUMAN_PLAYER, raise }),
    playAnnouncement: (announcement: AnnouncementType) =>
      act({ type: "announce", playerId: HUMAN_PLAYER, announcement }),
    playAnnouncementPass: () => act({ type: "announcePass", playerId: HUMAN_PLAYER }),
    playContra: (target: ContraTarget) => act({ type: "contra", playerId: HUMAN_PLAYER, target }),
    playCard: (card: Card) => act({ type: "play", playerId: HUMAN_PLAYER, card }),
    errorMessage: model.error,
    clearError: () => dispatch({ type: "clearError" }),
    storageWarning,
  };
}
export type TarokGame = ReturnType<typeof useTarokGame>;
