import { describe, expect, it } from "vitest";
import { BIDS, PASS, getGameLegalPlays, getHand } from "@tarok/engine";
import { chooseBotTurn, sessionReducer } from "../src/lib/gameSession";
import { isValidGameState, parseSession, serializeSession } from "../src/lib/session";
import { fresh, settings, settled, step, trajectory } from "./gameFixtures";

describe("versioned session invariants and replay", () => {
  it.each([...BIDS, "klop" as const])("restores and replays every phase of %s", (bid) => {
    const snapshots = trajectory(bid);
    for (const snapshot of snapshots) {
      expect(isValidGameState(snapshot.state), `${bid}: ${snapshot.state!.phase}`).toBe(true);
      expect(parseSession(serializeSession(snapshot)), `${bid}: ${snapshot.state!.phase}`).toEqual(
        JSON.parse(JSON.stringify(snapshot)),
      );
    }
    const final = settled(snapshots.slice(-1)[0]!);
    expect(parseSession(serializeSession(final))).toEqual(JSON.parse(JSON.stringify(final)));
  });

  it("rejects malformed settings, future versions, scores, radlci, and history", () => {
    const raw = JSON.parse(serializeSession(fresh()));
    const patches = [
      { version: 999 },
      { settings: { ...settings, botConfigs: [null, null, null] } },
      { settings: { ...settings, maxRounds: 0 } },
      {
        settings: {
          ...settings,
          botConfigs: settings.botConfigs.map((b) => ({ ...b, difficulty: 6 })),
        },
      },
      { round: 1.5 },
      { scores: [] },
      { scores: [0, "1", 0, 0] },
      { radlci: [-5, 0, 0, 0] },
      { radlci: [0.5, 0, 0, 0] },
      { score: { isWin: true } },
      { hist: [{}] },
    ];
    for (const patch of patches)
      expect(parseSession(JSON.stringify({ ...raw, ...patch }))).toBeNull();
  });

  it("rejects duplicate cards, illegal ranks, inconsistent turn and replay tampering", () => {
    const base = JSON.parse(serializeSession(fresh()));
    const mutate = (change: (value: typeof base) => void) => {
      const value = structuredClone(base);
      change(value);
      expect(parseSession(JSON.stringify(value))).toBeNull();
    };
    mutate((v) => {
      v.state.hands[0][0] = v.state.hands[1][0];
    });
    mutate((v) => {
      v.state.hands[0][0] = { kind: "tarok", rank: 1, name: "mond" };
    });
    mutate((v) => {
      v.state.hands[0][0] = { kind: "tarok", rank: "1", name: "pagat" };
    });
    mutate((v) => {
      delete v.state.compulsoryKlop;
    });
    mutate((v) => {
      v.state.playerOrder = [0, 0, 2, 3];
    });
    mutate((v) => {
      v.state.phase = "playing";
    });
    mutate((v) => {
      v.replay.actions = [{ type: "bid", playerId: 3, action: PASS }];
    });
    mutate((v) => {
      v.replay.botRngStates = [1, -1, 3];
    });
    mutate((v) => {
      v.state.hands[0].pop();
    });
  });

  it("migrates legacy state snapshots without losing card state", () => {
    const value = JSON.parse(serializeSession(fresh()));
    delete value.version;
    delete value.replay;
    delete value.state.compulsoryKlop;
    delete value.state.calledKingInPickedTalon;
    delete value.state.remainingTalonToDeclarer;
    const restored = parseSession(JSON.stringify(value));
    expect(restored?.state).toEqual(fresh().state);
  });

  it("resumes randomized bot decisions after every saved turn", () => {
    let session = fresh(71);
    session.settings = {
      ...settings,
      botConfigs: settings.botConfigs.map((b) => ({ ...b, difficulty: 1 })),
    };
    for (let i = 0; i < 80 && session.state!.phase !== "finished"; i++) {
      if (session.state!.currentPlayer === 0) {
        // Human uses a deterministic legal play; the bots keep their saved RNG sequence.
        session = step(
          session,
          session.state!.phase === "bidding"
            ? { type: "bid", playerId: 0, action: PASS }
            : {
                type: "play",
                playerId: 0,
                card: getGameLegalPlays(session.state!, 0, getHand(session.state!, 0))[0]!,
              },
        );
      } else {
        const restored = parseSession(serializeSession(session))!;
        expect(restored).not.toBeNull();
        const turn = chooseBotTurn(session);
        expect(chooseBotTurn(restored)).toEqual(turn);
        const next = sessionReducer(
          { session, error: null },
          { type: "apply", expected: session.state!, ...turn },
        );
        expect(next.error).toBeNull();
        session = next.session!;
      }
    }
    expect(session.state!.phase).toBe("finished");
  });
});

describe("seeded bot lifecycle stress", () => {
  it.each([1, 2, 3, 4, 5] as const)(
    "finishes 25 games at difficulty %s with restorable snapshots",
    (difficulty) => {
      for (let seed = 100; seed < 125; seed++) {
        let session = fresh(seed);
        session.settings = {
          ...settings,
          botConfigs: settings.botConfigs.map((b) => ({ ...b, difficulty })),
        };
        for (let turn = 0; turn < 300 && session.state!.phase !== "finished"; turn++) {
          const state = session.state!;
          if (state.currentPlayer === 0) {
            session = step(
              session,
              state.phase === "bidding"
                ? { type: "bid", playerId: 0, action: PASS }
                : state.phase === "announcements"
                  ? { type: "announcePass", playerId: 0 }
                  : {
                      type: "play",
                      playerId: 0,
                      card: getGameLegalPlays(state, 0, getHand(state, 0))[0]!,
                    },
            );
          } else {
            const next = sessionReducer(
              { session, error: null },
              { type: "apply", expected: state, ...chooseBotTurn(session) },
            );
            expect(next.error, `seed=${seed}, phase=${state.phase}`).toBeNull();
            session = next.session!;
          }
          if (turn % 10 === 0) expect(parseSession(serializeSession(session))).not.toBeNull();
        }
        expect(session.state!.phase).toBe("finished");
        expect(parseSession(serializeSession(settled(session)))).not.toBeNull();
      }
    },
  );
});

describe("atomic game transactions", () => {
  it("settles exactly once and starts the next round with carried scores and radlci", () => {
    const finished = trajectory("klop").slice(-1)[0]!;
    const first = settled(finished);
    const again = sessionReducer(
      { session: first, error: null },
      { type: "settle", expected: first.state! },
    );
    expect(again.session).toBe(first);
    expect(first.history).toHaveLength(1);
    expect(first.scores).toEqual(first.history[0]!.perPlayerDelta);
    const next = sessionReducer(again, { type: "next", seed: 123 });
    expect(next.error).toBeNull();
    expect(next.session?.round).toBe(2);
    expect(next.session?.scores).toEqual(first.scores);
    expect(next.session?.state?.radlci).toEqual(
      Object.fromEntries(first.radlci.map((r, i) => [i, r])),
    );
    expect(parseSession(serializeSession(next.session!))).not.toBeNull();
  });

  it("rejects stale timers and rolls back the entire batch on an invalid action", () => {
    const session = fresh();
    const next = step(session, { type: "bid", playerId: 0, action: PASS });
    const model = { session: next, error: null };
    expect(sessionReducer(model, { type: "apply", expected: session.state!, actions: [] })).toBe(
      model,
    );
    const failed = sessionReducer(
      { session, error: null },
      {
        type: "apply",
        expected: session.state!,
        actions: [
          { type: "bid", playerId: 0, action: PASS },
          { type: "bid", playerId: 0, action: PASS },
        ],
      },
    );
    expect(failed.error).not.toBeNull();
    expect(failed.session).toBe(session);
    expect(failed.session?.replay?.actions).toHaveLength(0);
    const recovered = sessionReducer(failed, { type: "clearError" });
    expect(
      sessionReducer(recovered, {
        type: "apply",
        expected: session.state!,
        actions: [{ type: "bid", playerId: 0, action: PASS }],
      }).error,
    ).toBeNull();
  });
});
