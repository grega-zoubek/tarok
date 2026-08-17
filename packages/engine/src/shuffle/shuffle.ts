import type { Card } from "../cards/card.js";
import { nextInt, type Rng } from "../rng/rng.js";

export function shuffle(deck: readonly Card[], rng: Rng): Card[] {
  const result = [...deck];

  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = nextInt(rng, i + 1);
    const current = result[i];
    const swap = result[j];

    if (current === undefined || swap === undefined) {
      throw new Error("shuffle encountered an unexpected empty slot");
    }

    result[i] = swap;
    result[j] = current;
  }

  return result;
}
