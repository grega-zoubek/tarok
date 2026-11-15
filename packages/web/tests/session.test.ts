import { describe, expect, it } from "vitest";
import { parseSession, serializeSession, type PersistedSession } from "../src/lib/session";

const settings = {
  humanName: "Grega",
  botConfigs: [
    { name: "Bot 1", difficulty: 2 as const },
    { name: "Bot 2", difficulty: 3 as const },
    { name: "Bot 3", difficulty: 4 as const },
  ],
  maxRounds: 8,
};

const session: PersistedSession = {
  settings,
  round: 3,
  history: [],
  scores: [10, -5, 0, -5],
  radlci: [0, 1, 0, 2],
  seed: 123456,
  state: null,
  roundScore: null,
};

describe("shranjevanje seje", () => {
  it("serializira in znova prebere sejo", () => {
    const restored = parseSession(serializeSession(session));

    expect(restored).toEqual(session);
  });

  it("ohrani stare ključe (hist namesto history)", () => {
    const raw = serializeSession(session);
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    expect(parsed.hist).toEqual([]);
    expect(parsed.round).toBe(3);
    expect(parsed.seed).toBe(123456);
  });

  it("vrne null za manjkajoč ali poškodovan zapis", () => {
    expect(parseSession(null)).toBeNull();
    expect(parseSession("")).toBeNull();
    expect(parseSession("{")).toBeNull();
    expect(parseSession("[]")).toBeNull();
    expect(parseSession(JSON.stringify({ round: 1 }))).toBeNull();
  });

  it("zapolni manjkajoča polja z varnimi privzetki", () => {
    const restored = parseSession(
      JSON.stringify({ settings, round: 1 }),
    );

    expect(restored).not.toBeNull();
    expect(restored?.history).toEqual([]);
    expect(restored?.scores).toEqual([0, 0, 0, 0]);
    expect(restored?.radlci).toEqual([0, 0, 0, 0]);
    expect(restored?.seed).toBeNull();
    expect(restored?.state).toBeNull();
    expect(restored?.roundScore).toBeNull();
  });

  it("ohrani rezultat tekočega kroga, da se obnovitev ne obračuna znova", () => {
    const roundScore = {
      isWin: true,
      razlika: 10,
      contractValue: 20,
      declarerTeam: { cardPoints: 45, wonTrula: false, wonKings: false, collectedCards: [] },
      defendingTeam: { cardPoints: 25, wonTrula: false, wonKings: false, collectedCards: [] },
      uncollectedCards: [],
      bonusValue: 0,
      mondfang: 0,
      mondfangPlayerId: undefined,
      bonuses: [],
      totalBeforeRadlci: 20,
      newRadlciEarned: 0,
    };
    const restored = parseSession(
      JSON.stringify({ ...JSON.parse(serializeSession(session)), score: roundScore }),
    );

    expect(restored?.roundScore).toEqual(roundScore);
  });

  it("zavrže neveljavno stanje igre", () => {
    const restored = parseSession(
      JSON.stringify({ settings, round: 1, state: { foo: "bar" } }),
    );

    expect(restored?.state).toBeNull();
  });
});
