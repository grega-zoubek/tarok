import type { GameState } from "../state/state.js";
import { type PlayerId, type Bid } from "../bidding/bidding.js";
import type { Card } from "../cards/card.js";
import { isTarokCard, cardKey } from "../cards/card.js";
import { countPoints, hasTrula, hasAllKings } from "./scoring.js";
import type { AnnouncementType } from "../announcements/announcements.js";

// ─────────────────────────────────────────────────────────────────────────────
// Vrednosti pogodb — vir: stevec-taroka.si/pravila
//
//  tri/dve/ena              10/20/30 + razlika  (z ekipo)
//  solo_tri/dve/ena         10/20/30 + razlika  (solo)
//  solo_brez                80                  (brez razlike)
//  berac                    70                  (negativna)
//  klop                     70                  (negativna, posebno štetje)
//  odprti_berac             90
//  barvni_valat             125
//  valat                    500
// ─────────────────────────────────────────────────────────────────────────────
export const CONTRACT_BASE_VALUES: Record<Bid | "klop", number> = {
  tri:          10,
  dve:          20,
  ena:          30,
  solo_tri:     40,
  solo_dve:     50,
  solo_ena:     60,
  solo_brez:    80,
  berac:        70,
  klop:         70,
  odprti_berac: 90,
  barvni_valat: 125,
  valat:        500,
};

// Stara oznaka ohranjena za združljivost
export const CONTRACT_VALUES = CONTRACT_BASE_VALUES;

// ─────────────────────────────────────────────────────────────────────────────
// Vrednosti bonusov — tiha vrednost (napovedana = 2×)
// ─────────────────────────────────────────────────────────────────────────────
export const BONUS_BASE_VALUES: Record<AnnouncementType, number> = {
  trula:        10,
  kralji:       10,
  pagat_ultimo: 25,
  kralj_ultimo: 10,
  valat:        250,
};

// Stara oznaka ohranjena za združljivost
export const ANNOUNCEMENT_VALUES = BONUS_BASE_VALUES;

/** Igre, ki dajo vsakemu igralcu +1 radlc po koncu igre */
export const RADLC_AWARDING_CONTRACTS = new Set<Bid | "klop">([
  "klop", "berac", "odprti_berac", "barvni_valat", "valat",
]);

/** Igre brez razlike (samo osnovna vrednost, brez +/- točk kart) */
export const NO_DIFFERENCE_CONTRACTS = new Set<Bid | "klop">([
  "solo_brez", "berac", "klop", "odprti_berac", "barvni_valat", "valat",
]);

export interface BonusResult {
  readonly type: AnnouncementType;
  readonly announcedBy: "declarer" | "defenders" | "silent";
  readonly achieved: boolean;
  /** + pomeni dobiček za aktivno ekipo, − pomeni izgubo */
  readonly value: number;
  /** @deprecated Uporabi value */
  readonly radlci: number;
}

export interface TeamScoreResult {
  readonly cardPoints: number;
  readonly wonTrula: boolean;
  readonly wonKings: boolean;
  readonly collectedCards: readonly Card[];
  /** @deprecated Uporabi wonTrula / wonKings */
  readonly wonBonuses: { readonly trula: boolean; readonly kings: boolean };
}

export interface GameScoreResult {
  readonly declarerTeam: TeamScoreResult;
  readonly defendingTeam: TeamScoreResult;
  readonly uncollectedCards: readonly Card[];
  readonly isWin: boolean;

  /** Zaokrožena razlika točk (koraki po 5); 0 za igre brez razlike */
  readonly razlika: number;
  /** @deprecated Uporabi razlika */
  readonly pointDifference: number;

  /** Vrednost pogodbe z razliko in predznakom (+ zmaga, − poraz) */
  readonly contractValue: number;
  /** @deprecated Uporabi contractValue */
  readonly contractRadlci: number;

  /** Skupna vrednost vseh bonusov */
  readonly bonusValue: number;

  /** Mondfang kazen (0 ali −21) */
  readonly mondfang: number;
  /** ID igralca, ki je izgubil monda (če mondfang < 0) */
  readonly mondfangPlayerId: number | undefined;

  readonly bonuses: readonly BonusResult[];

  /** Skupaj pred upoštevanjem radlcev (contractValue + bonusValue) */
  readonly totalBeforeRadlci: number;
  /** @deprecated Uporabi totalBeforeRadlci */
  readonly totalRadlci: number;

  /** Novi radlci, ki jih dobi vsak aktivni igralec (+1 za klop/berač/valat tip) */
  readonly newRadlciEarned: number;

  // Klop-specifično (prisotno samo kadar contract === "klop")
  readonly klopPlayerPoints?: Record<number, number>;
  readonly klopWinners?: number[];
  readonly klopLosers?: number[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Zaokroži navzdol na najbližji večkratnik 5
// Pravilo: cifra 8,9,0,1,2 → zaokroži na 0; cifra 3,4,5,6,7 → zaokroži na 5
// Primer: 49 → 50,  47 → 45,  43 → 45,  41 → 40,  55 → 55,  57 → 55
// ─────────────────────────────────────────────────────────────────────────────
function roundToNearest5(n: number): number {
    return Math.round(n / 5) * 5;
  }

/**
 * Aplikacija radlcev: vsak radlc podvoji vrednost igre.
 * Mondfang se NE podvoji.
 */
export function applyRadlci(
  totalBeforeRadlci: number,
  declarerRadlci: number,
): { finalValue: number; radlciUsed: number } {
  if (declarerRadlci <= 0 || totalBeforeRadlci === 0) {
    return { finalValue: totalBeforeRadlci, radlciUsed: 0 };
  }
  const multiplier = Math.pow(2, declarerRadlci);
  return {
    finalValue: totalBeforeRadlci * multiplier,
    radlciUsed: declarerRadlci,
  };
}

/**
 * Izračuna popolni rezultat igre po uradnih pravilih (stevec-taroka.si).
 */
export function calculateGameScore(state: GameState): GameScoreResult {
  if (state.phase !== "finished" || !state.trickRound) {
    throw new Error("Igre ni mogoče oceniti, ker ni končana.");
  }

  const contract = state.contract as Bid | "klop";

  // Klop ima posebno štetje
  if (contract === "klop") {
    return calculateKlopScore(state);
  }

  const { teams, discardedCards, trickRound } = state;

  if (!teams || state.declarer === undefined) {
    throw new Error("Ekipe morajo biti določene za normalno štetje.");
  }

  // ── 1. Zberi karte po ekipah ─────────────────────────────────────────────
  const playerCollectedCards: Record<PlayerId, Card[]> = {};
  for (const playerId of state.playerOrder) playerCollectedCards[playerId] = [];
  for (const ct of trickRound.capturedTricks) {
    ct.trick.plays.forEach(p => playerCollectedCards[ct.winner]?.push(p.card));
  }

  const declarerCollected: Card[] = [...discardedCards];
  const defendingCollected: Card[] = [];
  const declarerTeamIds = new Set(teams.declarerTeam);

  for (const playerId of state.playerOrder) {
    const cards = playerCollectedCards[playerId] ?? [];
    if (declarerTeamIds.has(playerId)) {
      declarerCollected.push(...cards);
    } else {
      defendingCollected.push(...cards);
    }
  }

  // Nepobranih skupin talona gredo branilcem.
  // state.talon = vseh 6 originalnih kart talona.
  // Del je šel v roke deklaranta (in zdaj živi v capturedTricks ali discardedCards).
  // Preostanek, ki ni bil nikjer obračunan, gre branilcem.
  const accountedKeys = new Set([
    ...declarerCollected,
    ...defendingCollected,
  ].map(cardKey));
  const uncollectedCards = state.talon.filter(c => !accountedKeys.has(cardKey(c)));
  defendingCollected.push(...uncollectedCards);

  // ── 2. Točke kart ────────────────────────────────────────────────────────
  const declarerPoints = countPoints(declarerCollected);
  const defendingPoints = countPoints(defendingCollected);

  const declarerWonTrula = hasTrula(declarerCollected);
  const declarerWonKings = hasAllKings(declarerCollected);
  const defendingWonTrula = hasTrula(defendingCollected);
  const defendingWonKings = hasAllKings(defendingCollected);

  // ── 3. Zmaga ─────────────────────────────────────────────────────────────
  // Igre brez razlike: zmaga = aktivni pobere vse štihe
  // Berač / odprti berač: zmaga = deklarant NE pobere NOBENEGA štiha
  //   (če vzame vsaj 1 štih → takojšen poraz, že zapre v dispatchPlay)
  // Ostale igre: zmaga = aktivna ekipa doseže ≥ 35 točk IN deklarant je pobral
  //   vsaj 1 štih ("35 točk in ena karta" po pravilih)
  let isWin: boolean;
  if (contract === "berac" || contract === "odprti_berac") {
    const declarerTricks = trickRound.capturedTricks.filter(t => declarerTeamIds.has(t.winner)).length;
    isWin = declarerTricks === 0;
  } else if (NO_DIFFERENCE_CONTRACTS.has(contract)) {
    const declarerTricks = trickRound.capturedTricks.filter(t => declarerTeamIds.has(t.winner)).length;
    isWin = declarerTricks === trickRound.capturedTricks.length;
  } else {
    // "in ena karta": deklarant sam mora imeti vsaj 1 osvojen štih
    const declarerPersonalTricks = trickRound.capturedTricks.filter(t => t.winner === state.declarer).length;
    isWin = declarerPoints >= 35 && declarerPersonalTricks >= 1;
  }

  // ── 4. Razlika (zaokrožena navzdol na 5) ────────────────────────────────
  // Razlika = roundDown5(točke aktivne ekipe) − 35
  // Primer: 41 točk → 40 − 35 = +5;  28 točk → 25 − 35 = −10
  const hasDifference = !NO_DIFFERENCE_CONTRACTS.has(contract);
  const razlika = hasDifference ? (roundToNearest5(declarerPoints) - 35) : 0;

  // ── 5. Vrednost pogodbe ──────────────────────────────────────────────────
  // Zmaga:  +osnova + razlika
  // Poraz:  −osnova + razlika  (razlika je negativna → skupaj bolj negativno)
  const contractBase = CONTRACT_BASE_VALUES[contract];
  const contractValue = (isWin ? contractBase : -contractBase) + razlika;

  // ── 6. Bonusi ────────────────────────────────────────────────────────────
  const bonuses: BonusResult[] = [];
  const announcements = state.announcementsRound?.announcements ?? {};
  const announcedByDeclarer = new Set<AnnouncementType>();
  const announcedByDefenders = new Set<AnnouncementType>();

  for (const [pidStr, playerAnns] of Object.entries(announcements)) {
    const pid = Number(pidStr) as PlayerId;
    for (const ann of playerAnns) {
      (declarerTeamIds.has(pid) ? announcedByDeclarer : announcedByDefenders).add(ann.type);
    }
  }

  function evalBonus(type: AnnouncementType, achievedByDeclarer: boolean): void {
    const base = BONUS_BASE_VALUES[type];
    const decAnn = announcedByDeclarer.has(type);
    const defAnn = announcedByDefenders.has(type);
    let v: number;
    let announcedBy: BonusResult["announcedBy"];
    let achieved: boolean;

    if (achievedByDeclarer) {
      achieved = true;
      if (decAnn)      { announcedBy = "declarer";  v = base * 2; }
      else if (defAnn) { announcedBy = "defenders"; v = base * 2; achieved = false; } // branilci izgubijo napoved
      else             { announcedBy = "silent";    v = base; }
    } else {
      achieved = false;
      if (defAnn)      { announcedBy = "defenders"; v = -(base * 2); achieved = true; }
      else if (decAnn) { announcedBy = "declarer";  v = -(base * 2); }
      else             { announcedBy = "silent";    v = -base; }
    }
    bonuses.push({ type, announcedBy, achieved, value: v, radlci: v });
  }

  // Pogodbe pri katerih se trula in kralji NE štejejo
  // (berač, odprti berač, valat, barvni valat, solo brez)
  const noTrulaKings = new Set<Bid | "klop">(
    ["berac", "odprti_berac", "valat", "barvni_valat", "solo_brez"]
  );

  // Trula in kralji: samo za navadne pogodbe (tri/dve/ena/solo_tri/solo_dve/solo_ena)
  if (!noTrulaKings.has(contract)) {
    // Trula (pagat + mond + škis):
    //   - VSI 3 pri deklarantu   → +10 (ali +20 če napovedana)
    //   - VSI 3 pri branilcih    → −10 (ali −20 če napovedana)
    //   - RAZDELJENA (1 ali 2 pri eni ekipi) → 0, RAZEN če je bila napovedana
    const trulaAnnounced = announcedByDeclarer.has("trula") || announcedByDefenders.has("trula");
    if (declarerWonTrula || defendingWonTrula || trulaAnnounced) {
      evalBonus("trula", declarerWonTrula);
    }

    // Enako za kralje (vsi 4 kralji):
    //   - VSI 4 pri deklarantu   → +10
    //   - VSI 4 pri branilcih    → −10
    //   - RAZDELJENA              → 0, RAZEN če napovedana
    const kraljiAnnounced = announcedByDeclarer.has("kralji") || announcedByDefenders.has("kralji");
    if (declarerWonKings || defendingWonKings || kraljiAnnounced) {
      evalBonus("kralji", declarerWonKings);
    }
  }

  // Pagat ultimo: preverimo zadnji štih
  const lastTrick = trickRound.capturedTricks[trickRound.capturedTricks.length - 1];
  if (lastTrick) {
    const pagatPlay = lastTrick.trick.plays.find(p => isTarokCard(p.card) && p.card.rank === 1);
    const pagatInLast = pagatPlay !== undefined;
    // Pagat ultimo: pagat mora biti v zadnjem štihu IN mora biti tisti, ki ga je vrgel, tudi zmagovalec
    const pagatUltimoAchievedByDeclarer = pagatInLast
      && declarerTeamIds.has(lastTrick.winner)
      && pagatPlay!.playerId === lastTrick.winner;

    if (pagatInLast || announcedByDeclarer.has("pagat_ultimo") || announcedByDefenders.has("pagat_ultimo")) {
      evalBonus("pagat_ultimo", pagatUltimoAchievedByDeclarer);
    }

    // Kralj ultimo: samo če je napovedan
    if (announcedByDeclarer.has("kralj_ultimo") || announcedByDefenders.has("kralj_ultimo")) {
      const kingPlay = lastTrick.trick.plays.find(p => !isTarokCard(p.card) && p.card.rank === "king");
      const kingUltimoByDeclarer = kingPlay !== undefined
        && declarerTeamIds.has(lastTrick.winner)
        && kingPlay.playerId === lastTrick.winner;
      evalBonus("kralj_ultimo", kingUltimoByDeclarer);
    }
  }

  // Valat napoved
  if (announcedByDeclarer.has("valat") || announcedByDefenders.has("valat")) {
    const declarerWonAll = trickRound.capturedTricks.every(t => declarerTeamIds.has(t.winner));
    evalBonus("valat", declarerWonAll);
  }

  const bonusValue = bonuses.reduce((s, b) => s + b.value, 0);

  // ── 7. Mondfang (−21, NE podvoji se z radlci) ────────────────────────────
  const mondfangContracts = new Set<Bid | "klop">(
    ["tri", "dve", "ena", "solo_tri", "solo_dve", "solo_ena", "solo_brez"]
  );
  let mondfang = 0;
  let mondfangPlayerId: number | undefined = undefined;

  if (mondfangContracts.has(contract)) {
    // 1. Primer: Mond je ostal v nepobrani skupini talona
    const mondInTalon = state.talon.find(c => isTarokCard(c) && c.rank === 21);
    if (mondInTalon) {
      const mondPicked = state.discardedCards.some(c => isTarokCard(c) && c.rank === 21);
      if (!mondPicked) {
        // Deklarant je "pustil" monda v talonu -> on ga izgubi
        mondfang = -21;
        mondfangPlayerId = state.declarer;
      }
    }

    // 2. Primer: Igralec je igral monda, a ni zmagal štiha (če ni bilo v talonu)
    if (mondfang === 0) {
      for (const ct of trickRound.capturedTricks) {
        const mondPlay = ct.trick.plays.find(p => isTarokCard(p.card) && p.card.rank === 21);
        if (mondPlay && mondPlay.playerId !== ct.winner) {
          // Igralec mondPlay.playerId je vrgel monda, zmagal je ct.winner (škis)
          mondfang = -21;
          mondfangPlayerId = mondPlay.playerId;
          break;
        }
      }
    }
  }

  // ── 8. Skupaj ────────────────────────────────────────────────────────────
  const totalBeforeRadlci = contractValue + bonusValue;
  const newRadlciEarned = RADLC_AWARDING_CONTRACTS.has(contract) ? 1 : 0;

  return {
    declarerTeam: {
      cardPoints: declarerPoints,
      wonTrula: declarerWonTrula,
      wonKings: declarerWonKings,
      collectedCards: declarerCollected,
      wonBonuses: { trula: declarerWonTrula, kings: declarerWonKings },
    },
    defendingTeam: {
      cardPoints: defendingPoints,
      wonTrula: defendingWonTrula,
      wonKings: defendingWonKings,
      collectedCards: defendingCollected,
      wonBonuses: { trula: defendingWonTrula, kings: defendingWonKings },
    },
    uncollectedCards,
    isWin,
    razlika,
    pointDifference: razlika,
    contractValue,
    contractRadlci: contractValue,
    bonusValue,
    mondfang,
    mondfangPlayerId,
    bonuses,
    totalBeforeRadlci,
    totalRadlci: totalBeforeRadlci,
    newRadlciEarned,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Klop štetje
// ─────────────────────────────────────────────────────────────────────────────
function calculateKlopScore(state: GameState): GameScoreResult {
  const { trickRound } = state;
  if (!trickRound) throw new Error("Ni trick rounde.");

  const playerCards: Record<number, Card[]> = {};
  for (const pid of state.playerOrder) playerCards[pid] = [];
  for (const ct of trickRound.capturedTricks) {
    ct.trick.plays.forEach(p => playerCards[ct.winner]?.push(p.card));
  }

  // Talon karte: prvih 6 štihov dobi vsak po eno karto iz talona.
  // Zmagovalec štiha N (0-indeks) dobi talon[N].
  for (let i = 0; i < Math.min(trickRound.capturedTricks.length, state.talon.length); i++) {
    const talonCard = state.talon[i];
    const winner = trickRound.capturedTricks[i]?.winner;
    if (talonCard !== undefined && winner !== undefined) {
      playerCards[winner]?.push(talonCard);
    }
  }

  const playerPoints: Record<number, number> = {};
  for (const pid of state.playerOrder) {
    playerPoints[pid] = countPoints(playerCards[pid] ?? []);
  }

  // Zmagovalec klopa = tisti, ki ni vzel niti enega štiha (in torej nobene talon karte)
  const winners = state.playerOrder.filter(pid => (playerCards[pid]?.length ?? 0) === 0);
  const losers  = state.playerOrder.filter(pid => (playerPoints[pid] ?? 0) > 35);

  const empty: TeamScoreResult = {
    cardPoints: 0, wonTrula: false, wonKings: false,
    collectedCards: [], wonBonuses: { trula: false, kings: false },
  };

  return {
    declarerTeam: empty,
    defendingTeam: empty,
    uncollectedCards: [],
    isWin: winners.length > 0,
    razlika: 0,
    pointDifference: 0,
    contractValue: 0,
    contractRadlci: 0,
    bonusValue: 0,
    mondfang: 0,
    bonuses: [],
    totalBeforeRadlci: 0,
    totalRadlci: 0,
    newRadlciEarned: 0,
    mondfangPlayerId: undefined,
    klopPlayerPoints: playerPoints,
    klopWinners: winners,
    klopLosers: losers,
  };
}