// @vitest-environment jsdom
import React, { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PASS, getGameLegalPlays, getHand } from "@tarok/engine";
import { useTarokGame } from "../src/hooks/useTarokGame";
import { chooseBotTurn } from "../src/lib/gameSession";
import { parseSession, serializeSession, SESSION_STORAGE_KEY } from "../src/lib/session";
import { fresh, settings, settled, step, trajectory } from "./gameFixtures";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <StrictMode>{children}</StrictMode>
);
const mount = () => renderHook(() => useTarokGame(), { wrapper });
const save = (session: ReturnType<typeof fresh>) =>
  sessionStorage.setItem(SESSION_STORAGE_KEY, serializeSession(session));
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
const stored = () => parseSession(sessionStorage.getItem(SESSION_STORAGE_KEY))!;

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("real React game lifecycle under StrictMode", () => {
  it("restores a finished game and persists exactly one complete settlement", () => {
    save(trajectory("klop").slice(-1)[0]!);
    const first = mount();
    expect(first.result.current.roundScore).toBeNull();
    advance(3000);
    expect(first.result.current.history).toHaveLength(1);
    const scores = first.result.current.playerScores;
    expect(stored().history).toHaveLength(1);
    expect(stored().scores).toEqual(scores);
    first.unmount();
    const reloaded = mount();
    advance(10_000);
    expect(reloaded.result.current.playerScores).toEqual(scores);
    expect(reloaded.result.current.history).toHaveLength(1);
    act(() => reloaded.result.current.nextRound());
    expect(reloaded.result.current.currentRound).toBe(2);
    expect(reloaded.result.current.playerScores).toEqual(scores);
    expect(reloaded.result.current.roundScore).toBeNull();
  });

  it("cleans up an interrupted scoring timer and reschedules it after reload", () => {
    save(trajectory("tri").slice(-1)[0]!);
    const first = mount();
    advance(1500);
    first.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const second = mount();
    advance(2999);
    expect(second.result.current.history).toHaveLength(0);
    advance(1);
    expect(second.result.current.history).toHaveLength(1);
  });

  it("ignores late actions and error dismissal without duplicate history", () => {
    const final = trajectory("tri").slice(-1)[0]!;
    save(final);
    const hook = mount();
    // The public action cannot mutate a finished game or double-settle it.
    act(() => hook.result.current.playBid(PASS));
    advance(3000);
    expect(hook.result.current.history).toHaveLength(1);
    act(() => hook.result.current.clearError());
    advance(10_000);
    expect(hook.result.current.history).toHaveLength(1);
  });

  it("recovers from corrupted storage and illegal actions without losing a round", () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{"state":{"phase":"playing"}}');
    const hook = mount();
    expect(hook.result.current.gameState).toBeNull();
    expect(hook.result.current.errorMessage).toContain("poškodovana");
    act(() => {
      hook.result.current.clearError();
      hook.result.current.startGame(settings);
    });
    const original = hook.result.current.gameState;
    act(() => hook.result.current.playCard(getHand(original!, 0)[0]!));
    expect(hook.result.current.errorMessage).not.toBeNull();
    expect(hook.result.current.gameState).toBe(original);
    act(() => hook.result.current.clearError());
    act(() => hook.result.current.playBid(PASS));
    expect(hook.result.current.errorMessage).toBeNull();
    expect(hook.result.current.gameState?.currentPlayer).toBe(1);
  });

  it("continues safely with blocked browser storage and displays a save warning", () => {
    vi.spyOn(Object.getPrototypeOf(sessionStorage) as Storage, "getItem").mockImplementation(() => {
      throw new Error("Blocked");
    });
    vi.spyOn(Object.getPrototypeOf(sessionStorage) as Storage, "setItem").mockImplementation(() => {
      throw new Error("Quota");
    });
    const hook = mount();
    expect(hook.result.current.errorMessage).toContain("Shramba");
    act(() => hook.result.current.startGame(settings));
    expect(hook.result.current.gameState?.phase).toBe("bidding");
    expect(hook.result.current.storageWarning).toContain("ni mogoče shraniti");
    act(() => hook.result.current.playBid(PASS));
    expect(hook.result.current.gameState?.currentPlayer).toBe(1);
  });

  it("resumes the same bot action after reload midway through its timer", () => {
    const session = step(fresh(72), { type: "bid", playerId: 0, action: PASS });
    save(session);
    const expected = chooseBotTurn(session);
    const first = mount();
    advance(350);
    first.unmount();
    expect(vi.getTimerCount()).toBe(0);
    const second = mount();
    advance(700);
    expect(stored().replay?.actions.slice(-expected.actions.length)).toEqual(expected.actions);
    expect(stored().replay?.botRngStates).toEqual(expected.botRngStates);
    second.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, 1])("animates captures made by seat %s and cancels animation on quit", (seat) => {
    const session = [42, 43, 44, 45, 46, 47]
      .flatMap((seed) => trajectory("klop", seed))
      .find(
        (s) =>
          s.state?.phase === "playing" &&
          s.state.currentPlayer === seat &&
          s.state.trickRound?.currentTrick.plays.length === 3 &&
          s.state.trickRound.capturedTricks.length < 6,
      )!;
    expect(session).toBeDefined();
    save(session);
    const hook = mount();
    if (seat === 0)
      act(() =>
        hook.result.current.playCard(
          getGameLegalPlays(session.state!, 0, getHand(session.state!, 0))[0]!,
        ),
      );
    else advance(700);
    expect(hook.result.current.isProcessingTrick).toBe(true);
    advance(500);
    expect(hook.result.current.showKlopTalon).toBe(true);
    advance(1500);
    expect(hook.result.current.isMovingCards).toBe(true);
    act(() => hook.result.current.quitGame());
    advance(10_000);
    expect(hook.result.current.gameState).toBeNull();
    expect(hook.result.current.isProcessingTrick).toBe(false);
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("does not re-settle an already scored legacy round", () => {
    const session = settled(trajectory("klop").slice(-1)[0]!);
    delete session.replay;
    save(session);
    const hook = mount();
    advance(10_000);
    expect(hook.result.current.playerScores).toEqual(session.scores);
    expect(hook.result.current.history).toHaveLength(1);
  });
});
