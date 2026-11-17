import React from "react";
import {
  cardKey,
  getDiscardPool,
  getExchangeCount,
  getGameLegalPlays,
  isSuitCard,
  isTarokCard,
  suitStrength,
  tarokStrength,
  type Card,
} from "@tarok/engine";
import type { TarokGame } from "../hooks/useTarokGame";
import { PlayingCard } from "./PlayingCard";

export function PlayerHand({
  game,
  selected,
  onSelect,
}: {
  game: TarokGame;
  selected: Card[];
  onSelect: (card: Card) => void;
}) {
  const state = game.gameState!;
  const myTurn = state.currentPlayer === game.HUMAN_PLAYER;
  const discarding = state.phase === "talon" && state.pickedTalonGroupIndex !== undefined && myTurn;
  const hand = [...state.hands[game.HUMAN_PLAYER]!].sort((a, b) => {
    if (isTarokCard(a)) return isTarokCard(b) ? tarokStrength(b) - tarokStrength(a) : -1;
    if (isTarokCard(b)) return 1;
    const order = { diamonds: 0, clubs: 1, hearts: 2, spades: 3 };
    return order[a.suit] - order[b.suit] || suitStrength(b) - suitStrength(a);
  });
  const allowed =
    state.phase === "playing"
      ? getGameLegalPlays(state, game.HUMAN_PLAYER, hand)
      : discarding
        ? getDiscardPool(hand, getExchangeCount(state.contract))
        : [];
  const keys = new Set(allowed.map(cardKey));
  const status =
    state.phase === "finished"
      ? "IGRA ZAKLJUČENA"
      : myTurn
        ? "TI SI NA POTEZI"
        : `ČAKAŠ NA ${game.playerNames[state.currentPlayer ?? -1]?.toUpperCase() ?? "..."}`;
  return (
    <section
      aria-label="Tvoje karte"
      className="relative flex flex-col items-center justify-end pb-2"
    >
      <p
        role="status"
        aria-live="polite"
        className={`mb-2 px-6 py-1 rounded-full text-sm font-bold border-2 ${myTurn ? "bg-yellow-400 text-green-900 border-white" : "bg-black/40 text-white/70 border-white/10"}`}
      >
        {status}
      </p>
      <div className="w-full overflow-x-auto pt-10 pb-2">
        <div className="flex justify-center items-end min-w-max mx-auto px-4">
          {hand.map((card) => {
            const chosen = discarding && selected.some((c) => cardKey(c) === cardKey(card));
            const legal = keys.has(cardKey(card));
            const enabled = myTurn && legal && !game.isProcessingTrick;
            return (
              <div
                key={cardKey(card)}
                style={{ marginLeft: hand.length > 8 ? "-28px" : "2px" }}
                className={`transition-transform duration-200 flex-shrink-0 ${chosen ? "-translate-y-8 scale-105 z-40" : enabled ? "hover:-translate-y-6 hover:z-30" : ""} ${myTurn && !legal ? "opacity-35 grayscale" : ""}`}
              >
                <PlayingCard
                  card={card}
                  disabled={!enabled}
                  selected={discarding ? chosen : undefined}
                  onClick={() => (discarding ? onSelect(card) : game.playCard(card))}
                />
                {discarding && chosen && isSuitCard(card) && (
                  <span className="sr-only">Izbrana za založitev</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
