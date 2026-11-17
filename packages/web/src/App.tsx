import React, { useState } from "react";
import { cardKey, getExchangeCount, isTarokCard, PASS, type Card } from "@tarok/engine";
import { useTarokGame, type TarokGame } from "./hooks/useTarokGame";
import { PlayingCard } from "./components/PlayingCard";
import { SetupScreen } from "./components/SetupScreen";
import { Modal } from "./components/Modal";
import { BotTalonPanel, PhasePanel } from "./components/PhasePanel";
import { PlayerHand } from "./components/PlayerHand";
import { FinalScore, RoundScoreDialog, ScoreSidebar } from "./components/ScoreViews";
import { ANN_SL, SUIT_SL, bidLabel } from "./lib/labels";

const PHASE_SL = {
  bidding: "LICITACIJA",
  calling: "KLICANJE",
  talon: "TALON",
  raising: "DVIG",
  announcements: "NAPOVEDI",
  playing: "IGRA",
  finished: "KONEC",
};
const POSITIONS = ["bottom", "right", "top", "left"] as const;
const LABEL_LAYOUT = {
  top: "top-[-45px]",
  bottom: "bottom-[-40px]",
  left: "left-0 -translate-x-1/3",
  right: "right-0 translate-x-1/3",
};
const CARD_LAYOUT = {
  bottom: "translate-y-24",
  top: "-translate-y-24",
  left: "-translate-x-24",
  right: "translate-x-24",
};
const FLY_LAYOUT = {
  bottom: "translate-y-[400px] opacity-0 scale-50",
  top: "-translate-y-[400px] opacity-0 scale-50",
  left: "-translate-x-[400px] opacity-0 scale-50",
  right: "translate-x-[400px] opacity-0 scale-50",
};

function GameView({ game, onQuit }: { game: TarokGame; onQuit: () => void }) {
  const state = game.gameState!;
  const [selection, setSelection] = useState<Card[]>([]);
  const discardPhase =
    state.phase === "talon" &&
    state.pickedTalonGroupIndex !== undefined &&
    state.currentPlayer === 0;
  const selected = discardPhase ? selection : [];
  const plays =
    game.isProcessingTrick && game.lastCapturedTrick
      ? game.lastCapturedTrick.trick.plays
      : (state.trickRound?.currentTrick.plays ?? []);
  const fly =
    game.isMovingCards && game.lastCapturedTrick
      ? FLY_LAYOUT[POSITIONS[game.lastCapturedTrick.winner]!]
      : "";
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-green-800 text-white font-sans overflow-x-hidden">
      <ScoreSidebar game={game} onQuit={onQuit} />
      <main className="flex-grow min-w-0 flex flex-col p-4 relative">
        <header className="flex flex-wrap justify-between gap-2 items-center bg-black/30 p-3 rounded-lg mb-4 border border-white/10">
          <div>
            <p className="text-yellow-400 text-xs font-bold">Faza</p>
            <p className="text-lg font-bold">{PHASE_SL[state.phase]}</p>
          </div>
          <div className="flex flex-wrap gap-2 items-center text-center">
            <div className="bg-yellow-500/10 px-3 py-1 rounded-full border border-yellow-500/20">
              <p className="text-yellow-400 text-xs font-bold">POGODBA</p>
              <p className="text-sm font-black">
                {state.contract ? bidLabel(state.contract).toUpperCase() : "..."}
              </p>
            </div>
            {state.compulsoryKlop && state.phase === "bidding" && (
              <p className="text-orange-300 text-xs font-bold">OBVEZNI KLOP</p>
            )}
            {state.calledKing && (
              <div className="bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
                <p className="text-blue-300 text-xs">KLICAN KRALJ</p>
                <p className="text-sm capitalize">{SUIT_SL[state.calledKing.suit]}</p>
              </div>
            )}
            {state.announcementsRound && (
              <div className="flex flex-wrap gap-1 text-xs">
                {state.announcementsRound.gameMultiplier > 1 && (
                  <span className="bg-orange-700 p-1 rounded">
                    KONTRA ×{state.announcementsRound.gameMultiplier}
                  </span>
                )}
                {Object.entries(state.announcementsRound.announcements).flatMap(([pid, anns]) =>
                  anns.map((ann) => (
                    <span
                      key={`${pid}-${ann.type}`}
                      className="bg-purple-700 p-1 rounded"
                      title={game.playerNames[Number(pid)]}
                    >
                      {ANN_SL[ann.type]}
                      {ann.multiplierLevel > 1 ? ` ×${ann.multiplierLevel}` : ""}
                    </span>
                  )),
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-yellow-400 text-xs font-bold">Na potezi</p>
            <p className="font-bold text-yellow-300">
              {state.currentPlayer === undefined ? "Nihče" : game.playerNames[state.currentPlayer]}
            </p>
          </div>
        </header>
        <div className="flex-grow relative flex items-center justify-center py-12">
          <div className="w-[min(500px,82vw)] h-[min(500px,82vw)] max-h-[60vh] bg-green-700/50 rounded-full border-[12px] border-green-900 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] relative flex items-center justify-center">
            {POSITIONS.map((pos, pid) => {
              const lastBid = [...state.bids].reverse().find((b) => b.playerId === pid);
              const calledKingPlayed =
                state.calledKing &&
                [
                  ...(state.trickRound?.capturedTricks.flatMap((ct) => ct.trick.plays) ?? []),
                  ...(state.trickRound?.currentTrick.plays ?? []),
                ].some(
                  (p) =>
                    p.playerId === pid &&
                    p.card.kind === "suit" &&
                    p.card.rank === "king" &&
                    p.card.suit === state.calledKing?.suit,
                );
              return (
                <div
                  key={pid}
                  className={`absolute flex flex-col items-center z-20 max-w-24 ${LABEL_LAYOUT[pos]}`}
                >
                  <p
                    className={`font-black text-sm sm:text-xl truncate max-w-full ${state.currentPlayer === pid ? "text-yellow-400" : "text-white/80"}`}
                  >
                    {game.playerNames[pid]}
                    {state.declarer === pid ? " ★" : ""}
                    {calledKingPlayed && pid !== state.declarer ? " · partner" : ""}
                  </p>
                  {lastBid && state.phase !== "playing" && state.phase !== "finished" && (
                    <span className="bg-blue-800 px-2 rounded text-xs">
                      {lastBid.action === PASS ? "naprej" : bidLabel(lastBid.action)}
                    </span>
                  )}
                </div>
              );
            })}
            {state.contract === "odprti_berac" &&
              state.declarer !== undefined &&
              state.phase === "playing" && (
                <section
                  aria-label="Odprta roka deklaranta"
                  className="absolute top-2 left-1/2 -translate-x-1/2 z-20 bg-black/50 p-2 rounded-xl max-w-[280px]"
                >
                  <p className="text-xs text-red-300 text-center">
                    Odprta roka — {game.playerNames[state.declarer]}
                  </p>
                  <div className="flex flex-wrap gap-0.5 justify-center">
                    {state.hands[state.declarer]?.map((card) => (
                      <PlayingCard key={cardKey(card)} card={card} disabled size="sm" />
                    ))}
                  </div>
                </section>
              )}
            {state.discardedCards.some(isTarokCard) && (
              <section
                aria-label="Odloženi taroki"
                className="absolute bottom-2 z-20 bg-black/40 px-2 rounded-lg"
              >
                <p className="text-xs text-yellow-300 text-center">Odloženi taroki</p>
                <div className="flex gap-1">
                  {state.discardedCards.filter(isTarokCard).map((card) => (
                    <PlayingCard key={cardKey(card)} card={card} disabled size="sm" />
                  ))}
                </div>
              </section>
            )}
            <div className="relative w-full h-full flex items-center justify-center">
              {game.isProcessingTrick &&
                game.showKlopTalon &&
                state.contract === "klop" &&
                state.trickRound &&
                state.trickRound.capturedTricks.length <= 6 && (
                  <div className={`absolute z-20 ${fly}`}>
                    <PlayingCard
                      card={state.talon[state.trickRound.capturedTricks.length - 1]}
                      disabled
                    />
                  </div>
                )}
              {plays.map((play) => (
                <div
                  key={`${play.playerId}-${cardKey(play.card)}`}
                  className={`absolute transition-all duration-[1500ms] ease-in-out z-10 ${fly || CARD_LAYOUT[POSITIONS[play.playerId]!]}`}
                >
                  <PlayingCard card={play.card} disabled />
                </div>
              ))}
            </div>
            <BotTalonPanel game={game} />
            <PhasePanel
              game={game}
              selectedCount={selected.length}
              onConfirmDiscard={() => game.playDiscard(selected)}
            />
          </div>
        </div>
        <PlayerHand
          game={game}
          selected={selected}
          onSelect={(card) =>
            setSelection((current) =>
              current.some((c) => cardKey(c) === cardKey(card))
                ? current.filter((c) => cardKey(c) !== cardKey(card))
                : current.length < getExchangeCount(state.contract)
                  ? [...current, card]
                  : current,
            )
          }
        />
      </main>
    </div>
  );
}

export default function App() {
  const game = useTarokGame();
  const [final, setFinal] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const quit = () => {
    game.quitGame();
    setFinal(false);
    setQuitting(false);
  };
  return (
    <>
      {!game.gameState ? (
        <SetupScreen
          onStart={(settings) => {
            setFinal(false);
            game.startGame(settings);
          }}
        />
      ) : final ? (
        <FinalScore game={game} onNew={quit} />
      ) : (
        <GameView key={game.currentRound} game={game} onQuit={() => setQuitting(true)} />
      )}
      {game.storageWarning && (
        <p
          role="status"
          className="fixed bottom-0 left-0 right-0 bg-orange-900 text-white p-2 text-sm z-50"
        >
          {game.storageWarning}
        </p>
      )}
      {!final && !game.errorMessage && !quitting && (
        <RoundScoreDialog game={game} onFinal={() => setFinal(true)} />
      )}
      {quitting && (
        <Modal title="Zapusti igro?" onClose={() => setQuitting(false)}>
          <p className="mb-4">Trenutni napredek bo izbrisan.</p>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 bg-blue-700 p-3 rounded"
              onClick={() => setQuitting(false)}
            >
              Nadaljuj igro
            </button>
            <button type="button" className="flex-1 bg-red-700 p-3 rounded" onClick={quit}>
              Zapusti
            </button>
          </div>
        </Modal>
      )}
      {game.errorMessage && (
        <Modal title="Napaka" onClose={game.clearError}>
          <p role="alert" className="mb-6">
            {game.errorMessage}
          </p>
          <button
            type="button"
            onClick={game.clearError}
            className="w-full bg-red-600 p-3 rounded font-bold"
          >
            V redu
          </button>
        </Modal>
      )}
    </>
  );
}
