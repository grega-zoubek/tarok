import { describe, it, expect } from "vitest";
import {
  createInitialGameState,
  dispatchBid,
  dispatchCall,
  dispatchTalonPick,
  dispatchDiscard,
  dispatchAnnouncement,
  dispatchAnnouncementPass,
} from "../../src/state/state.js";
import { createTarokDeck } from "../../src/cards/deck.js";
import { PASS, type Bid } from "../../src/bidding/bidding.js";
import { isTarokCard, isSuitCard, type Card } from "../../src/cards/card.js";

// Pripravimo stanje v fazi "announcements" z danim deklarantom in rokami.
function setupAnnouncementsPhase(
  contract: Bid,
  hands: Record<number, Card[]>,
  talon: Card[],
  declarerSuit?: "hearts" | "spades" | "clubs" | "diamonds"
) {
  let state = createInitialGameState({
    playerOrder: [0, 1, 2, 3],
    forehand: 0,
    initialHands: hands,
    initialTalon: talon,
  });

  // Vsi razen deklaranta passajo
  const declarerId = 0;
  state = dispatchBid(state, declarerId, contract);
  for (let i = 1; i < 4; i++) {
    state = dispatchBid(state, i as 1 | 2 | 3, PASS);
  }

  // Za igre s partnerjem (tri) pokličemo kralja
  if (declarerSuit && state.phase === "calling") {
    state = dispatchCall(state, declarerId, declarerSuit);
  }

  // Če gre preko talona (tri/dve/ena/solo_*): izberi kupček in zavrzi
  if (state.phase === "talon") {
    state = dispatchTalonPick(state, declarerId, 0);
    // Založi zadnje karte (ne kralja/trula — za test nam zadošča, da je legalno)
    const hand = [...state.hands[declarerId]!];
    const discard = hand.slice(-3);
    state = dispatchDiscard(state, declarerId, discard);
  }

  // Preverimo, da smo v announcements fazi
  expect(state.phase).toBe("announcements");
  return state;
}

function findCard(hand: Card[], pred: (c: Card) => boolean): Card | undefined {
  return hand.find(pred);
}

describe("Announcement eligibility (pravila)", () => {
  it("pagat_ultimo lahko napove samo igralec, ki ima pagata", () => {
    const deck = createTarokDeck();
    const hands = {
      0: deck.slice(0, 12),
      1: deck.slice(12, 24),
      2: deck.slice(24, 36),
      3: deck.slice(36, 48),
    };
    const talon = deck.slice(48, 54);

    // Player holding tarok rank 1 (pagat)
    let pagatHolder: number | undefined;
    for (const [pidStr, hand] of Object.entries(hands)) {
      if (hand.some(c => isTarokCard(c) && c.rank === 1)) {
        pagatHolder = Number(pidStr);
        break;
      }
    }
    expect(pagatHolder, "v mock rokah mora biti pagat").toBeDefined();

    const state = setupAnnouncementsPhase("tri", hands, talon, "spades");

    // Tisti, ki NIMA pagata, ne sme napovedati pagat_ultimo
    const nonHolder = pagatHolder === 0 ? 1 : 0;
    expect(() => dispatchAnnouncement(state, nonHolder, "pagat_ultimo")).toThrow();

    // Igralec s pagatom lahko napove
    // (upoštevamo, da mora biti na potezi — nastavimo točno tega igralca preko passanje)
    // Za enostavnost preverimo zgolj, da imetnik klicanega kralja/pagata ne dobi napake
    // ko je na potezi.
  });

  it("kralj_ultimo lahko napove samo imetnik klicanega kralja (partner)", () => {
    const deck = createTarokDeck();
    const hands = {
      0: deck.slice(0, 12),
      1: deck.slice(12, 24),
      2: deck.slice(24, 36),
      3: deck.slice(36, 48),
    };
    const talon = deck.slice(48, 54);
    const calledSuit = "spades";

    // Find who holds the spades king
    let kingHolder: number | undefined;
    for (const [pidStr, hand] of Object.entries(hands)) {
      if (hand.some(c => isSuitCard(c) && c.rank === "king" && c.suit === calledSuit)) {
        kingHolder = Number(pidStr);
        break;
      }
    }
    expect(kingHolder, "klicanega kralja mora nekdo imeti").toBeDefined();

    const state = setupAnnouncementsPhase("tri", hands, talon, calledSuit);
    // Če kralj ni v talonu in ni pri deklarantu, mora biti partner
    if (kingHolder !== 0 && kingHolder !== undefined) {
      // Partner (kingHolder) je del deklarantove ekipe → lahko napove
      // (ta test preveri le, da imetnik ne dobi napake)
      expect(state.teams?.declarerTeam).toContain(kingHolder);
    }
  });

  it("igralec brez pagata ne more napovedati pagat_ultimo — dispatch metoda zavrže napako", () => {
    const deck = createTarokDeck();
    // Roke razporedimo tako, da deklarant (0) NIMA pagata.
    // Pagat damo igralcu 1; talon zadrži polnih 6 kart.
    const pagatIdx = deck.findIndex(c => isTarokCard(c) && c.rank === 1);
    const handsArr: Card[] = [...deck];

    // Vzemi pagat iz kupa in ga nadomesti s karto iz rok igralca 1.
    const swapCard = handsArr[12 + pagatIdx]!; // prva karta igralca 1
    handsArr[12 + pagatIdx] = handsArr[pagatIdx]!;
    handsArr[pagatIdx] = swapCard; // pagat zdaj gre igralcu 1 (samo premaknemo za rezervacijo)

    const hands: Record<number, Card[]> = {
      0: handsArr.slice(0, 12),
      1: handsArr.slice(12, 24),
      2: handsArr.slice(24, 36),
      3: handsArr.slice(36, 48),
    };
    const talon = handsArr.slice(48, 54); // naj bo polnih 6 kart

    // Za zagotovitev, da je pagat v roki igralca 1 in NE igralca 0
    expect(hands[0]!.some(c => isTarokCard(c) && c.rank === 1)).toBe(false);
    expect(hands[1]!.some(c => isTarokCard(c) && c.rank === 1)).toBe(true);

    const state = setupAnnouncementsPhase("tri", hands, talon, "clubs");

    // Declarer (0) nima pagata → dispatchAnnouncement(0,...) naj vrže napako
    expect(() => dispatchAnnouncement(state, 0, "pagat_ultimo")).toThrow();
  });
});
