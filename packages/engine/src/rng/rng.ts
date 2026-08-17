export interface Rng {
  /** Returns a floating-point value in the range [0, 1). */
  next(): number;
}

/**
 * Creates a deterministic pseudo-random number generator from a numeric seed.
 * Uses a mulberry32 algorithm suitable for shuffling and simulations.
 */
export function createSeededRng(seed: number): Rng {
  let state = seed >>> 0;

  return {
    next(): number {
      state += 0x6d2b79f5;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** Returns a uniform integer in the range [0, max). */
export function nextInt(rng: Rng, max: number): number {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError("max must be a positive integer");
  }

  return Math.floor(rng.next() * max);
}
