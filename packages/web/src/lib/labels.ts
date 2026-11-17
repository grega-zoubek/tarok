import type { AnnouncementType, Bid, Suit } from "@tarok/engine";
export const SUIT_SL: Record<Suit, string> = {
  hearts: "srce",
  diamonds: "kara",
  clubs: "križ",
  spades: "pik",
};
export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
  spades: "♠",
};
export const SUITS: readonly Suit[] = ["hearts", "diamonds", "clubs", "spades"];
export const BID_SL: Record<Bid | "klop", string> = {
  tri: "Tri",
  dve: "Dve",
  ena: "Ena",
  solo_tri: "Solo tri",
  solo_dve: "Solo dve",
  solo_ena: "Solo ena",
  berac: "Berač",
  solo_brez: "Solo brez",
  odprti_berac: "Odprti berač",
  barvni_valat: "Barvni valat",
  valat: "Valat",
  klop: "Klop",
};
export const bidLabel = (contract: string) => BID_SL[contract as keyof typeof BID_SL] ?? contract;
export const ANN_SL: Record<AnnouncementType, string> = {
  trula: "Trula",
  kralji: "Kralji",
  pagat_ultimo: "Pagat ultimo",
  kralj_ultimo: "Kralj ultimo",
  valat: "Valat",
};
