import { describe, expect, it } from "vitest";

import { SUIT_CATALOG } from "../src/cards/suit-catalog.js";
import { TAROK_CATALOG } from "../src/cards/tarok-catalog.js";
import { addPlay, createTrick, getKlopLegalPlays } from "../src/trick/trick.js";

const pagat = TAROK_CATALOG.find((card) => card.name === "pagat")!;
const tarokXx = TAROK_CATALOG.find((card) => card.name === "xx")!;
const mond = TAROK_CATALOG.find((card) => card.name === "mond")!;
const skis = TAROK_CATALOG.find((card) => card.name === "skis")!;
const heartKing = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "king",
)!;
const heartQueen = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "queen",
)!;
const heartJack = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "jack",
)!;
const heartAce = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "ace",
)!;
const heartTwo = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "two",
)!;
const heartFour = SUIT_CATALOG.find(
  (card) => card.suit === "hearts" && card.rank === "four",
)!;
const clubKing = SUIT_CATALOG.find(
  (card) => card.suit === "clubs" && card.rank === "king",
)!;

describe("klop legal plays", () => {
  it("pagat ne sme pasti, dokler ima igralec drug tarok", () => {
    const hand = [pagat, tarokXx, clubKing];

    const legal = getKlopLegalPlays(hand, createTrick(0));

    expect(legal).toEqual([tarokXx, clubKing]);
    expect(legal).not.toContain(pagat);
  });

  it("pagat je dovoljen šele kot zadnja karta v roki", () => {
    expect(getKlopLegalPlays([pagat, clubKing], createTrick(0))).toEqual([clubKing]);
    expect(getKlopLegalPlays([pagat], createTrick(0))).toEqual([pagat]);
  });

  it("tretji igralec mora nadigrati najvišjo karto na mizi", () => {
    const trick = addPlay(
      addPlay(createTrick(0), { playerId: 0, card: heartFour }),
      { playerId: 1, card: heartAce },
    );
    const hand = [heartQueen, heartKing, pagat];

    const legal = getKlopLegalPlays(hand, trick);

    expect(legal).toEqual([heartQueen, heartKing]);
    expect(legal).not.toContain(pagat);
  });

  it("četrti igralec mora nadigrati najvišjo karto na mizi", () => {
    const trick = addPlay(
      addPlay(
        addPlay(createTrick(0), { playerId: 0, card: heartFour }),
        { playerId: 1, card: heartAce },
      ),
      { playerId: 2, card: heartKing },
    );
    const hand = [heartJack, heartTwo, clubKing];

    // Kralj je najvišji — višje karte ni, zato sme igrati katerokoli srce.
    const legal = getKlopLegalPlays(hand, trick);

    expect(legal).toEqual([heartJack, heartTwo]);
    expect(legal).not.toContain(clubKing);
  });

  it("brez možnosti nadigravanja sme igrati katerokoli karto vodilne barve", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: heartKing });
    const hand = [heartJack, heartTwo, clubKing];

    expect(getKlopLegalPlays(hand, trick)).toEqual([heartJack, heartTwo]);
  });

  it("na tarok mora nadigrati z višjim tarokom, pagat pa ostane zaščiten", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: pagat });
    const hand = [pagat, tarokXx, mond, clubKing];

    // Pagat je edini tarok, ki ne sme pasti, dokler so na voljo drugi taroki.
    const legal = getKlopLegalPlays(hand, trick);

    expect(legal).toEqual([tarokXx, mond]);
  });

  it("ko taroka ni mogoče nadigrati, sme igrati katerikoli tarok (razen pagata, dokler so drugi)", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: skis });
    const hand = [pagat, tarokXx, mond];

    expect(getKlopLegalPlays(hand, trick)).toEqual([tarokXx, mond]);
  });

  it("brez barve mora igrati tarok in ne sme odvreči barvne karte", () => {
    const trick = addPlay(createTrick(0), { playerId: 0, card: heartKing });
    const hand = [tarokXx, clubKing];

    expect(getKlopLegalPlays(hand, trick)).toEqual([tarokXx]);
  });
});
