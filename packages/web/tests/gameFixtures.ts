import {
  PASS,
  getDiscardPool,
  getExchangeCount,
  getGameLegalPlays,
  getHand,
  type Bid,
  type GameAction,
} from "@tarok/engine";
import { sessionReducer, type SessionModel } from "../src/lib/gameSession";
import type { GameSettings } from "../src/hooks/useTarokGame";
import type { PersistedSession } from "../src/lib/session";

export const settings: GameSettings = {
  humanName: "Grega",
  maxRounds: 8,
  botConfigs: [1, 2, 3].map((i) => ({ name: `Bot ${i}`, difficulty: 3 })),
};

export function fresh(seed = 42): PersistedSession {
  const model = sessionReducer({ session: null, error: null }, { type: "start", settings, seed });
  if (model.error || !model.session) throw new Error(model.error ?? "No session");
  return model.session;
}

export function step(session: PersistedSession, action: GameAction): PersistedSession {
  const next = sessionReducer(
    { session, error: null },
    { type: "apply", expected: session.state!, actions: [action] },
  );
  if (next.error || !next.session) throw new Error(next.error ?? "No session");
  return next.session;
}

/** Deliberately exercises every contract, rather than relying on sampled bot bids. */
export function trajectory(bid: Bid | "klop", seed = 42): PersistedSession[] {
  let session = fresh(seed);
  const snapshots = [session];
  for (let turns = 0; session.state!.phase !== "finished" && turns < 300; turns++) {
    const state = session.state!;
    const playerId = state.currentPlayer!;
    let action: GameAction;
    switch (state.phase) {
      case "bidding":
        action = {
          type: "bid",
          playerId,
          action: state.bids.length === 0 && bid !== "klop" ? bid : PASS,
        };
        break;
      case "calling":
        action = { type: "call", playerId, suit: "hearts" };
        break;
      case "talon":
        action =
          state.pickedTalonGroupIndex === undefined
            ? { type: "talonPick", playerId, groupIndex: 0 }
            : {
                type: "discard",
                playerId,
                cards: getDiscardPool(
                  getHand(state, playerId),
                  getExchangeCount(state.contract),
                ).slice(0, getExchangeCount(state.contract)),
              };
        break;
      case "raising":
        action = { type: "raise", playerId, raise: false };
        break;
      case "announcements":
        action = { type: "announcePass", playerId };
        break;
      case "playing":
        action = {
          type: "play",
          playerId,
          card: getGameLegalPlays(state, playerId, getHand(state, playerId))[0]!,
        };
        break;
      default:
        throw new Error("Unexpected phase");
    }
    session = step(session, action);
    snapshots.push(session);
  }
  if (session.state!.phase !== "finished") throw new Error("Stalled game");
  return snapshots;
}

export function settled(session: PersistedSession): PersistedSession {
  const model: SessionModel = sessionReducer(
    { session, error: null },
    { type: "settle", expected: session.state! },
  );
  if (model.error || !model.session?.roundScore) throw new Error(model.error ?? "No score");
  return model.session;
}
