import type { AnnouncementType, ContraTarget } from "../announcements/announcements.js";
import type { BiddingAction, PlayerId } from "../bidding/bidding.js";
import type { Card } from "../cards/card.js";
import type { Suit } from "../cards/suit.js";
import {
  dispatchAnnouncement,
  dispatchAnnouncementPass,
  dispatchBid,
  dispatchCall,
  dispatchContra,
  dispatchDiscard,
  dispatchPlay,
  dispatchRaiseToBarvniValat,
  dispatchTalonPick,
  type GameState,
} from "./state.js";

/**
 * Enotna akcija igre. Omogoča en reducer za UI, bote, replay in bodoči strežnik.
 */
export type GameAction =
  | { readonly type: "bid"; readonly playerId: PlayerId; readonly action: BiddingAction }
  | { readonly type: "call"; readonly playerId: PlayerId; readonly suit: Suit | undefined }
  | { readonly type: "talonPick"; readonly playerId: PlayerId; readonly groupIndex: number }
  | { readonly type: "discard"; readonly playerId: PlayerId; readonly cards: readonly Card[] }
  | { readonly type: "raise"; readonly playerId: PlayerId; readonly raise: boolean }
  | { readonly type: "contra"; readonly playerId: PlayerId; readonly target: ContraTarget }
  | { readonly type: "announce"; readonly playerId: PlayerId; readonly announcement: AnnouncementType }
  | { readonly type: "announcePass"; readonly playerId: PlayerId }
  | { readonly type: "play"; readonly playerId: PlayerId; readonly card: Card };

export function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "bid":
      return dispatchBid(state, action.playerId, action.action);
    case "call":
      return dispatchCall(state, action.playerId, action.suit);
    case "talonPick":
      return dispatchTalonPick(state, action.playerId, action.groupIndex);
    case "discard":
      return dispatchDiscard(state, action.playerId, action.cards);
    case "raise":
      return dispatchRaiseToBarvniValat(state, action.playerId, action.raise);
    case "contra":
      return dispatchContra(state, action.playerId, action.target);
    case "announce":
      return dispatchAnnouncement(state, action.playerId, action.announcement);
    case "announcePass":
      return dispatchAnnouncementPass(state, action.playerId);
    case "play":
      return dispatchPlay(state, action.playerId, action.card);
  }
}

/** Vrne akcijo, ki jo v danem stanju lahko izvede igralec (za replay/bote). */
export function getActionPlayer(action: GameAction): PlayerId {
  return action.playerId;
}
