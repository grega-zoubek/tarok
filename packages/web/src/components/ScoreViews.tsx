import React from "react";
import { CONTRACT_BASE_VALUES, NO_DIFFERENCE_CONTRACTS } from "@tarok/engine";
import type { TarokGame } from "../hooks/useTarokGame";
import { ANN_SL, bidLabel } from "../lib/labels";
import { Modal } from "./Modal";
const signed = (value: number) => `${value >= 0 ? "+" : ""}${value}`;

export function ScoreSidebar({ game, onQuit }: { game: TarokGame; onQuit: () => void }) {
  return (
    <aside
      aria-label="Rezultati"
      className="w-full md:w-64 bg-black/40 border-b md:border-r border-white/10 p-4 flex flex-col max-h-48 md:max-h-none overflow-y-auto"
    >
      <h2 className="text-xl font-black text-yellow-400 mb-4">REZULTATI</h2>
      <button
        type="button"
        onClick={onQuit}
        className="mb-4 py-1 text-xs font-bold bg-red-900/40 border border-red-700 text-red-300 rounded-lg"
      >
        Zapusti igro
      </button>
      <div className="flex-grow overflow-y-auto space-y-2 custom-scrollbar">
        {game.history.length === 0 && (
          <p className="text-xs text-gray-400 italic">Ni odigranih iger.</p>
        )}
        {game.history.map((result) => (
          <div
            key={result.round}
            className="p-3 rounded-lg border border-white/10 bg-black/20 text-sm"
          >
            <div className="flex justify-between">
              <span className="text-gray-300">#{result.round}</span>
              <span className="font-bold">{signed(result.perPlayerDelta[0] ?? 0)} točk</span>
            </div>
            <p className="text-yellow-100 font-bold">{bidLabel(result.contract)}</p>
            <p className="text-xs text-gray-300">
              {result.declarer}
              {result.mondfang < 0 ? " · mondfang" : ""}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-white/10">
        <p className="text-yellow-400 text-xs mb-2">
          KROG: {game.currentRound} / {game.maxRounds}
        </p>
        {game.playerNames.map((name, i) => (
          <div key={i} className="flex justify-between text-xs py-1 gap-2">
            <span className={`truncate ${i === 0 ? "text-yellow-200" : "text-gray-300"}`}>
              {name}
            </span>
            <span className="font-bold">
              {signed(game.playerScores[i] ?? 0)}
              {game.playerRadlci[i] ? ` · ${game.playerRadlci[i]} radlc` : ""}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}

export function RoundScoreDialog({ game, onFinal }: { game: TarokGame; onFinal: () => void }) {
  const score = game.roundScore;
  const state = game.gameState;
  if (!score || !state || state.phase !== "finished") return null;
  const result = game.history.find((r) => r.round === game.currentRound);
  const klop = state.contract === "klop";
  const active = state.teams?.declarerTeam.includes(0) ?? false;
  const won = klop ? score.klopWinners?.includes(0) : active ? score.isWin : !score.isWin;
  const isNoDiff = state.contract ? NO_DIFFERENCE_CONTRACTS.has(state.contract) : false;
  const multiplier = state.announcementsRound?.gameMultiplier ?? 1;
  const signedBase = state.contract
    ? (score.isWin ? 1 : -1) * CONTRACT_BASE_VALUES[state.contract] * multiplier
    : 0;
  const replaced = score.bonuses.some((b) => b.type === "valat" && b.announcedBy !== "silent");
  return (
    <Modal title={klop ? "KLOP" : won ? "Zmaga!" : "Poraz!"}>
      <p className="text-center text-xl text-yellow-100 mb-4">
        {bidLabel(state.contract ?? "klop")}
      </p>
      {klop ? (
        <div className="space-y-2 mb-4">
          {game.playerNames.map((name, i) => (
            <div key={i} className="flex justify-between bg-black/20 p-2 rounded text-sm">
              <span>{name}</span>
              <span>
                {signed(result?.perPlayerDelta[i] ?? 0)} ({score.klopPlayerPoints?.[i] ?? 0} kart.
                točk)
              </span>
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-center text-sm text-gray-300 mb-3">
            {active ? "Aktivna ekipa" : "Branilci"} · pogodba{" "}
            {score.isWin ? "uspešna" : "neuspešna"}
          </p>
          {!isNoDiff && (
            <div className="grid grid-cols-2 gap-3 mb-4 text-center">
              {[score.declarerTeam, score.defendingTeam].map((team, i) => (
                <div key={i} className="bg-black/20 p-3 rounded-xl">
                  <p className="text-xs text-gray-300">
                    {(i === 0 ? state.teams?.declarerTeam : state.teams?.defendingTeam)
                      ?.map((pid) => game.playerNames[pid])
                      .join(" + ")}
                  </p>
                  <p className="text-3xl font-bold">{team.cardPoints}</p>
                  <p className="text-xs">kart. točk</p>
                </div>
              ))}
            </div>
          )}
          <div className="bg-black/20 rounded-xl p-3 text-sm space-y-1 mb-4">
            <h3 className="text-gray-300 font-bold mb-2">Obračun (aktivna ekipa)</h3>
            {replaced ? (
              <p>Pogodba nadomeščena z napovedanim valatom</p>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Osnova</span>
                  <span>{signed(signedBase)}</span>
                </div>
                {!isNoDiff && (
                  <div className="flex justify-between">
                    <span>Razlika{multiplier > 1 ? ` ×${multiplier}` : ""}</span>
                    <span>{signed(score.razlika * multiplier)}</span>
                  </div>
                )}
              </>
            )}
            {score.bonuses.map((b, i) => (
              <div key={i} className="flex justify-between gap-2">
                <span>
                  {ANN_SL[b.type]} (
                  {b.announcedBy === "silent"
                    ? "tiho"
                    : b.announcedBy === "declarer"
                      ? "napoved"
                      : "bran. napoved"}
                  {b.announcedBy !== "silent" ? (b.achieved ? ", uspešno" : ", neuspešno") : ""})
                </span>
                <span>{signed(b.value)}</span>
              </div>
            ))}
            {!!result?.radlciUsed && (
              <p className="text-orange-300">Radlci ×{2 ** result.radlciUsed}</p>
            )}
            {score.mondfang < 0 && (
              <div className="flex justify-between text-red-300">
                <span>Mondfang ({game.playerNames[score.mondfangPlayerId ?? 0]})</span>
                <span>{score.mondfang}</span>
              </div>
            )}
          </div>
        </>
      )}
      {score.newRadlciEarned > 0 && (
        <p className="text-sm text-purple-300 text-center mb-3">
          Obračunani radlci za naslednjo igro so prikazani pri igralcih.
        </p>
      )}
      <p className="text-center text-5xl font-black text-green-300">
        {signed(result?.perPlayerDelta[0] ?? 0)}
      </p>
      <p className="text-center text-sm mb-6">Tvoje točke</p>
      <button
        type="button"
        onClick={game.currentRound < game.maxRounds ? game.nextRound : onFinal}
        className="w-full py-4 bg-yellow-500 text-green-900 font-black rounded-xl text-xl"
      >
        {game.currentRound < game.maxRounds ? "NASLEDNJI KROG" : "POGLEDAJ SKUPNI IZID"}
      </button>
    </Modal>
  );
}

export function FinalScore({ game, onNew }: { game: TarokGame; onNew: () => void }) {
  const plus = game.history.filter((r) => (r.perPlayerDelta[0] ?? 0) > 0).length;
  const minus = game.history.filter((r) => (r.perPlayerDelta[0] ?? 0) < 0).length;
  const neutral = game.history.length - plus - minus;
  return (
    <main className="flex items-center justify-center min-h-screen bg-green-900 text-white">
      <div className="bg-green-800 p-8 rounded-xl border-4 border-yellow-600 w-full max-w-md max-h-screen overflow-y-auto">
        <h1 className="text-4xl font-black text-yellow-400 text-center mb-4">KONČNI IZID</h1>
        <p className="text-center text-5xl font-black text-green-300">
          {signed(game.playerScores[0] ?? 0)}
        </p>
        <p className="text-center text-sm mb-6">
          {plus} plusov / {minus} minusov / {neutral} brez spremembe
        </p>
        <ol className="space-y-2 mb-6">
          {game.history.map((r) => (
            <li key={r.round} className="flex justify-between bg-black/20 p-2 rounded text-sm">
              <span>
                #{r.round} {bidLabel(r.contract)}
              </span>
              <span>{signed(r.perPlayerDelta[0] ?? 0)}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          onClick={onNew}
          className="w-full py-4 bg-yellow-500 text-green-900 font-black rounded-xl text-xl"
        >
          NOVA IGRA
        </button>
      </div>
    </main>
  );
}
