import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { createTarokDeck, type Card } from "@tarok/engine";
import { cardBackUrl, cardFaceUrl, CARD_BACK_URL } from "../src/cards/faceAssets";
import { PlayingCard } from "../src/components/PlayingCard";

const deck = createTarokDeck();
const pagat: Card = { kind: "tarok", rank: 1, name: "pagat" };
const mond: Card = { kind: "tarok", rank: 21, name: "mond" };
const skis: Card = { kind: "tarok", rank: "skis", name: "skis" };
const king: Card = { kind: "suit", suit: "hearts", rank: "king" };

function render(props: Parameters<typeof PlayingCard>[0]): string {
  return renderToStaticMarkup(createElement(PlayingCard, props));
}

function assetPath(url: string): URL {
  return new URL(`../public${url}`, import.meta.url);
}

describe("original card artwork", () => {
  it("maps the engine's complete deck to 54 distinct faces", () => {
    expect(deck).toHaveLength(54);
    const urls = deck.map((card) => cardFaceUrl(card, "/"));
    expect(new Set(urls).size).toBe(54);
    const files = readdirSync(fileURLToPath(new URL("../public/cards/faces/", import.meta.url)))
      .filter((file) => file.endsWith(".jpg"))
      .sort();
    expect(files).toEqual([...urls.map((url) => url.split("/").pop()), "back.jpg"].sort());
  });

  it.each(deck)("loads existing artwork for $kind $rank", (card) => {
    const src = cardFaceUrl(card, "/");
    const path = assetPath(src);
    expect(existsSync(path)).toBe(true);
    expect([...readFileSync(path).subarray(0, 2)]).toEqual([0xff, 0xd8]);
    const markup = render({ card });
    expect(markup).toContain(`src="${src}"`);
    expect(markup).toContain("card-face-img");
  });

  it("uses the correct Pagat, Mond, Škis and king files", () => {
    expect(cardFaceUrl(pagat)).toBe("/cards/faces/tarok-1.jpg");
    expect(cardFaceUrl(mond)).toBe("/cards/faces/tarok-21.jpg");
    expect(cardFaceUrl(skis)).toBe("/cards/faces/tarok-skis.jpg");
    expect(cardFaceUrl(king)).toBe("/cards/faces/hearts-king.jpg");
  });

  it("includes a valid back image", () => {
    expect(CARD_BACK_URL).toBe("/cards/faces/back.jpg");
    expect([...readFileSync(assetPath(CARD_BACK_URL)).subarray(0, 2)]).toEqual([0xff, 0xd8]);
  });

  it.each(["/tarok", "/tarok/"])("supports deployment under %s", (base) => {
    expect(cardFaceUrl(pagat, base)).toBe("/tarok/cards/faces/tarok-1.jpg");
    expect(cardBackUrl(base)).toBe("/tarok/cards/faces/back.jpg");
  });
});

describe("card tiles", () => {
  it("renders an enabled native button for an interactive card", () => {
    const markup = render({ card: pagat, onClick: vi.fn() });
    expect(markup).toMatch(/^<button /);
    expect(markup).toContain('type="button"');
    expect(markup).not.toContain('disabled=""');
    expect(markup).toContain('aria-label="Tarok Pagat"');
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain("cursor-pointer");
  });

  it("disables display-only and explicitly disabled cards", () => {
    expect(render({ card: pagat })).toContain('disabled=""');
    const markup = render({ card: pagat, onClick: vi.fn(), disabled: true });
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("cursor-default");
  });

  it.each([
    [pagat, "Tarok Pagat"],
    [mond, "Tarok Mond"],
    [skis, "Tarok Škis"],
    [king, "Srce kralj"],
  ] as const)("names %j in Slovenian", (card, label) => {
    expect(render({ card })).toContain(`aria-label="${label}"`);
  });

  it("shows only the back when face-down, without leaking the face name", () => {
    const markup = render({ card: pagat, faceDown: true });
    expect(markup).toContain(`src="${CARD_BACK_URL}"`);
    expect(markup).toContain('aria-label="Hrbtna stran karte"');
    expect(markup).not.toContain("Pagat");
  });

  it("shows the back when no card is provided", () => {
    expect(render({})).toContain(`src="${CARD_BACK_URL}"`);
  });

  it.each(["sm", "md", "lg"] as const)("preserves %s sizing and custom classes", (size) => {
    expect(render({ card: pagat, size, className: "selected-card" })).toContain(
      `card-face card-${size}`,
    );
    expect(render({ card: pagat, size, className: "selected-card" })).toContain("selected-card");
  });

  it("keeps artwork decorative and non-draggable inside its labeled button", () => {
    const markup = render({ card: pagat });
    expect(markup).toContain('alt=""');
    expect(markup).toContain('draggable="false"');
  });
});
