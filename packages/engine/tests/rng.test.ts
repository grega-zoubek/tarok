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

  it("returns values in the range [0, 1)", () => {
    const rng = createSeededRng(99);

    for (let index = 0; index < 100; index += 1) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
