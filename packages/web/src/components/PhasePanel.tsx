import React from "react";
import {
  ANNOUNCEMENTS,
  BIDS,
  PASS,
  canMakeAnnouncement,
  canPlaceContra,
  getLegalBidsForState,
  getExchangeCount,
} from "@tarok/engine";
import type { TarokGame } from "../hooks/useTarokGame";
import { ANN_SL, SUITS, SUIT_SL, SUIT_SYMBOL, bidLabel } from "../lib/labels";
import { PlayingCard } from "./PlayingCard";

export function PhasePanel({
  game,
  selectedCount,
  onConfirmDiscard,
}: {
  game: TarokGame;
  selectedCount: number;
  onConfirmDiscard: () => void;
}) {
  const state = game.gameState;
  if (
    !state ||
    state.currentPlayer !== game.HUMAN_PLAYER ||
    state.phase === "playing" ||
    state.phase === "finished"
  )
    return null;
  const panel =
    "bg-black/70 p-5 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-3 max-w-lg max-h-[65vh] overflow-y-auto";
  const button =
    "px-4 py-2 rounded font-bold text-sm uppercase bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-40";
  let content: React.ReactNode;
  switch (state.phase) {
    case "bidding": {
      const legal = getLegalBidsForState(state);
      content = (
        <>
          <h2 className="text-yellow-400 font-bold text-xl">LICITACIJA</h2>
          {state.compulsoryKlop && (
            <p className="text-orange-300 text-sm">
              Obvezni klop — dovoljene so samo licitacije od solo brez navzgor
            </p>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {BIDS.map((bid) => (
              <button
                type="button"
                key={bid}
                className={button}
                disabled={!legal.includes(bid)}
                onClick={() => game.playBid(bid)}
              >
                {bidLabel(bid)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => game.playBid(PASS)}
            className={`${button} bg-red-600 w-full`}
          >
            Naprej
          </button>
        </>
      );
      break;
    }
    case "calling":
      content = (
        <>
          <h2 className="text-yellow-400 font-bold">KLIČI KRALJA</h2>
          <div className="flex justify-center gap-3">
            {SUITS.map((suit) => (
              <button
                type="button"
                key={suit}
                aria-label={`Kliči kralja: ${SUIT_SL[suit]}`}
                onClick={() => game.playCall(suit)}
                className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-4xl"
              >
                {SUIT_SYMBOL[suit]}
              </button>
            ))}
          </div>
        </>
      );
      break;
    case "announcements": {
      const round = state.announcementsRound!;
      const team = state.teams?.declarerTeam ?? [state.declarer!];
      const targets = (["game", ...ANNOUNCEMENTS] as const).filter((target) =>
        canPlaceContra(round, game.HUMAN_PLAYER, target, team),
      );
      content = (
        <>
          <h2 className="text-yellow-400 font-bold">NAPOVEDI</h2>
          <div className="flex flex-wrap justify-center gap-2">
            {ANNOUNCEMENTS.map((type) => (
              <button
                type="button"
                key={type}
                className={button}
                disabled={!canMakeAnnouncement(state, game.HUMAN_PLAYER, type)}
                onClick={() => game.playAnnouncement(type)}
              >
                {ANN_SL[type]}
              </button>
            ))}
          </div>
          {targets.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2 border-t border-white/10 pt-2">
              <p className="w-full text-orange-300">Kontra</p>
              {targets.map((target) => (
                <button
                  type="button"
                  key={target}
                  className={`${button} bg-orange-600`}
                  onClick={() => game.playContra(target)}
                >
                  {target === "game" ? "Igra" : ANN_SL[target]}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => game.playAnnouncementPass()}
            className={`${button} bg-red-600 w-full`}
          >
            KONČAJ / NAPREJ
          </button>
        </>
      );
      break;
    }
    case "talon": {
      const picked = state.pickedTalonGroupIndex;
      if (picked === undefined)
        content = (
          <>
            <h2 className="text-yellow-400 font-bold">Izberi kupček</h2>
            <div className="flex flex-wrap gap-4 justify-center">
              {state.talonGroups.map((group, i) => (
                <div key={i} className="flex flex-col gap-2 items-center">
                  <div className="flex -space-x-7">
                    {group.map((card, ci) => (
                      <PlayingCard key={ci} card={card} disabled size="sm" />
                    ))}
                  </div>
                  <button type="button" onClick={() => game.playTalonPick(i)} className={button}>
                    KUPČEK {i + 1}
                  </button>
                </div>
              ))}
            </div>
          </>
        );
      else {
        const count = getExchangeCount(state.contract);
        content = (
          <>
            <h2 className="text-yellow-400 font-bold">Tvoj izbrani kupček</h2>
            <div className="flex justify-center gap-2">
              {state.talonGroups[picked]?.map((card, i) => (
                <PlayingCard key={i} card={card} disabled size="sm" />
              ))}
            </div>
            <p className="text-xs text-gray-300">Preostanek talona (gre branilcem):</p>
            <div className="flex flex-wrap justify-center gap-1 opacity-60">
              {state.talonGroups
                .flatMap((group, i) => (i === picked ? [] : group))
                .map((card, i) => (
                  <PlayingCard key={i} card={card} disabled size="sm" />
                ))}
            </div>
            <p className="text-sm text-yellow-100">
              Izberi {count} {count === 1 ? "karto" : count === 2 ? "karti" : "karte"} iz svoje roke
              za založitev.
            </p>
            <button
              type="button"
              disabled={selectedCount !== count}
              onClick={onConfirmDiscard}
              className={`${button} w-full bg-green-600`}
            >
              POTRDI ZALOG ({selectedCount})
            </button>
          </>
        );
      }
      break;
    }
    case "raising":
      content = (
        <>
          <h2 className="text-yellow-400 font-bold">Dvigni pogodbo?</h2>
          <p className="text-sm">
            Solo lahko po talonu dvigneš v barvni valat (taroki niso aduti, moraš vzeti vse štihe).
          </p>
          <button
            type="button"
            className={`${button} w-full bg-purple-600`}
            onClick={() => game.playRaise(true)}
          >
            BARVNI VALAT (125)
          </button>
          <button
            type="button"
            className={`${button} w-full`}
            onClick={() => game.playRaise(false)}
          >
            Ohrani {bidLabel(state.contract ?? "solo")}
          </button>
        </>
      );
      break;
  }
  return (
    <section
      aria-label="Dejanja trenutne faze"
      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
    >
      <div className={`${panel} pointer-events-auto`}>{content}</div>
    </section>
  );
}

export function BotTalonPanel({ game }: { game: TarokGame }) {
  const state = game.gameState;
  if (!state || state.phase !== "talon" || state.currentPlayer === game.HUMAN_PLAYER) return null;
  const picked = state.pickedTalonGroupIndex;
  return (
    <section
      aria-label="Bot izbira talon"
      className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-black/70 p-6 rounded-2xl border-2 border-white/20 text-center max-w-lg w-full">
        <h2 className="text-yellow-400 font-bold text-lg mb-2">
          {game.playerNames[state.currentPlayer!]} — Talon
        </h2>
        <p className="text-sm text-gray-300 mb-3">
          {picked === undefined ? "Izbira kupček..." : `Vzel kupček ${picked + 1}:`}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {picked === undefined
            ? state.talonGroups.map((g, i) => (
                <div key={i} className="flex -space-x-7">
                  {g.map((_, ci) => (
                    <PlayingCard key={ci} faceDown disabled size="sm" />
                  ))}
                </div>
              ))
            : state.talonGroups[picked]?.map((card, i) => (
                <PlayingCard key={i} card={card} disabled />
              ))}
        </div>
        {picked !== undefined && (
          <>
            <p className="text-xs text-gray-400 mt-3">Preostanek gre branilcem:</p>
            <div className="flex flex-wrap gap-1 justify-center opacity-60">
              {state.talonGroups
                .flatMap((g, i) => (i === picked ? [] : g))
                .map((card, i) => (
                  <PlayingCard key={i} card={card} disabled size="sm" />
                ))}
            </div>
            <p className="text-gray-400 text-xs mt-3">Bot izbira zaloge...</p>
          </>
        )}
      </div>
    </section>
  );
}
