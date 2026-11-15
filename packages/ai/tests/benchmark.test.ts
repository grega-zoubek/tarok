import { describe, expect, it } from "vitest";
import { runBenchmark } from "../src/benchmark.js";

describe("AI benchmark", () => {
  it("odigra 8 iger brez napak in s konsistentnim obračunom", () => {
    const summary = runBenchmark({
      seeds: [101, 202, 303, 404, 505, 606, 707, 808],
      difficulty: 3,
    });

    expect(summary.games).toBe(8);
    expect(summary.finished).toBe(8);
    expect(summary.errors).toBe(0);

    for (const result of summary.results) {
      expect(result.error).toBeNull();
      expect(result.finished).toBe(true);
      expect(result.steps).toBeGreaterThan(0);
      expect(result.contract).not.toBeNull();

      if (result.contract !== "klop") {
        expect(result.cardPointsSum).toBe(70);
      }
      expect(result.perPlayerDelta).not.toBeNull();
    }

    const gamesByContract = Object.values(summary.gamesByContract).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(gamesByContract).toBe(8);
  });

  it("je determinističen za enake seede", () => {
    const first = runBenchmark({ seeds: [42, 43], difficulty: 2 });
    const second = runBenchmark({ seeds: [42, 43], difficulty: 2 });

    expect(first.results).toEqual(second.results);
  });
});
