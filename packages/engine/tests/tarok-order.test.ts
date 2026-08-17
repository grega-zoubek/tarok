import { describe, expect, it } from "vitest";

import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import {
  compareTaroks,
  isHighestTarok,
  isLowestNumberedTarok,
  isSecondHighestTarok,
  tarokStrength,
} from "../src/cards/tarok-order.js";

const pagat = TAROK_CATALOG.find((card) => card.name === "pagat")!;
const mond = TAROK_CATALOG.find((card) => card.name === "mond")!;
const skis = TAROK_CATALOG.find((card) => card.rank === "skis")!;
const tarokIi = TAROK_CATALOG.find((card) => card.name === "ii")!;
const tarokXx = TAROK_CATALOG.find((card) => card.name === "xx")!;

describe("tarok order", () => {
  it("treats Škis as the highest tarok", () => {
    expect(isHighestTarok(skis)).toBe(true);

    for (const tarok of TAROK_CATALOG) {
      if (tarok.rank !== "skis") {
        expect(isHighestTarok(tarok)).toBe(false);
        expect(compareTaroks(skis, tarok)).toBe(1);
      }
    }
  });

  it("treats Mond as the second-highest tarok", () => {
    expect(isSecondHighestTarok(mond)).toBe(true);
    expect(compareTaroks(skis, mond)).toBe(1);
    expect(compareTaroks(mond, tarokXx)).toBe(1);
  });

  it("treats Pagat as the lowest numbered tarok", () => {
    expect(isLowestNumberedTarok(pagat)).toBe(true);
    expect(compareTaroks(pagat, tarokIi)).toBe(-1);
  });

  it("orders numbered taroks by rank", () => {
    const numberedTaroks = TAROK_CATALOG.filter((card) => card.rank !== "skis");

    for (let index = 0; index < numberedTaroks.length - 1; index += 1) {
      const current = numberedTaroks[index]!;
      const next = numberedTaroks[index + 1]!;

      expect(tarokStrength(next)).toBeGreaterThan(tarokStrength(current));
      expect(compareTaroks(next, current)).toBe(1);
    }
  });

  it("orders the key trumps as Škis > Mond > XX > Pagat", () => {
    expect(compareTaroks(skis, mond)).toBe(1);
    expect(compareTaroks(mond, tarokXx)).toBe(1);
    expect(compareTaroks(tarokXx, pagat)).toBe(1);
    expect(compareTaroks(skis, pagat)).toBe(1);
  });
});
