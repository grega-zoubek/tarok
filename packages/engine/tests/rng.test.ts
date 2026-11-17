import { describe, expect, it } from "vitest";

import { createSeededRng } from "../src/rng/rng.js";

describe("rng", () => {
  it("produces deterministic sequences for the same seed", () => {
    const first = createSeededRng(42);
    const second = createSeededRng(42);

    const firstValues = Array.from({ length: 5 }, () => first.next());
    const secondValues = Array.from({ length: 5 }, () => second.next());

    expect(firstValues).toEqual(secondValues);
  });

  it("produces different sequences for different seeds", () => {
    const first = createSeededRng(1);
    const second = createSeededRng(2);

    const firstValue = first.next();
    const secondValue = second.next();

    expect(firstValue).not.toEqual(secondValue);
  });

  it("resumes the exact sequence from a serialized uint32 state", () => {
    const rng = createSeededRng(0xffffffff);
    for (let i = 0; i < 100; i++) rng.next();
    const state = JSON.parse(JSON.stringify(rng.getState())) as number;
    expect(state).toBeGreaterThanOrEqual(0);
    expect(state).toBeLessThanOrEqual(0xffffffff);
    const restored = createSeededRng(state);
    expect(Array.from({ length: 100 }, () => restored.next())).toEqual(
      Array.from({ length: 100 }, () => rng.next()),
    );
  });

  it("returns values in the range [0, 1)", () => {
    const rng = createSeededRng(99);

    for (let index = 0; index < 100; index += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
