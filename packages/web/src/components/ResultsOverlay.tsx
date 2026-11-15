import type { GameScoreResult, GameState, PlayerId } from "@tarok/engine";
import { NO_DIFFERENCE_CONTRACTS } from "@tarok/engine";
import type { RoundResult } from "../hooks/useTarokGame";
import { strings } from "../lib/strings";

interface ResultsOverlayProps {
  gameState: GameState;
  roundScore: GameScoreResult;
  currentResult: RoundResult | undefined;
  playerNames: string[];
  humanPlayer: PlayerId;
  currentRound: number;
  maxRounds: number;
  onNextRound: () => void;
  onShowFinalScore: () => void;
}

export function ResultsOverlay({
  gameState,
  roundScore,
  currentResult,
  playerNames,
  humanPlayer,
  currentRound,
  maxRounds,
  onNextRound,
  onShowFinalScore,
}: ResultsOverlayProps) {
  const contract = gameState.contract;
  const isKlop = contract === "klop";
  const hasDifference = contract !== undefined && !NO_DIFFERENCE_CONTRACTS.has(contract);
  const declarerTeamNames =
    gameState.teams?.declarerTeam.map((pid) => playerNames[pid] ?? `Igralec ${pid}`).join(" + ") ??
    "";
  const defenderTeamNames =
    gameState.teams?.defendingTeam?.map((pid) => playerNames[pid] ?? `Igralec ${pid}`).join(" + ") ??
    "";
  const humanDelta = currentResult?.perPlayerDelta?.[humanPlayer] ?? 0;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 bg-black/70 backdrop-blur-lg p-3">
      <div className="bg-green-900 p-4 sm:p-6 rounded-3xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] text-center max-w-lg w-full overflow-y-auto max-h-[90vh]">
        {isKlop ? (
          <>
            <h2 className="text-4xl font-black mb-2 text-yellow-400">{strings.result.klop}</h2>
            <div className="mb-4 bg-black/20 rounded-xl p-3 text-left space-y-2">
              {playerNames.map((name, i) => {
                const delta = currentResult?.perPlayerDelta?.[i] ?? 0;
                const isWinner = roundScore.klopWinners?.includes(i);
                const isLoser = roundScore.klopLosers?.includes(i);
                return (
                  <div
                    key={i}
                    className={`flex justify-between text-sm p-2 rounded-lg border ${
                      isWinner
                        ? "bg-green-800/40 border-green-500"
                        : isLoser
                          ? "bg-red-900/40 border-red-500"
                          : "bg-black/10 border-white/5"
                    }`}
                  >
                    <span className="font-bold text-yellow-100">{name}</span>
                    <span className="font-black">
                      {isWinner ? (
                        <span className="text-green-400">
                          {delta >= 0 ? "+" : ""}
                          {delta} {strings.result.klopWinnerMark}
                        </span>
                      ) : isLoser ? (
                        <span className="text-red-400">
                          {delta} {strings.result.klopLoserMark}
                        </span>
                      ) : (
                        <span className="text-gray-300">{delta}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
            {roundScore.newRadlciEarned > 0 && (
              <p className="text-purple-300 text-sm mb-4">{strings.result.newRadlc}</p>
            )}
          </>
        ) : (
          <>
            <h2
              className={`text-4xl sm:text-5xl font-black mb-1 uppercase tracking-tighter ${
                roundScore.isWin ? "text-yellow-400" : "text-red-400"
              }`}
            >
              {roundScore.isWin ? strings.result.win : strings.result.loss}
            </h2>
            <p className="text-xl text-yellow-100 mb-4 font-serif italic">
              {contract?.replace("_", " ").toUpperCase()}
            </p>

            {hasDifference && (
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div
                  className={`p-4 rounded-2xl border-2 ${
                    roundScore.isWin
                      ? "bg-green-600/30 border-green-400"
                      : "bg-black/20 border-white/10"
                  }`}
                >
                  <span
                    className="block text-[10px] font-bold text-gray-300 uppercase mb-1 truncate"
                    title={declarerTeamNames}
                  >
                    {declarerTeamNames}
                  </span>
                  <span className="text-3xl font-black">
                    {roundScore.declarerTeam.cardPoints}
                  </span>
                  <span className="block text-[10px] text-gray-400 mt-1">
                    {strings.result.contractPoints}
                  </span>
                </div>
                <div
                  className={`p-4 rounded-2xl border-2 ${
                    !roundScore.isWin
                      ? "bg-green-600/30 border-green-400"
                      : "bg-black/20 border-white/10"
                  }`}
                >
                  <span
                    className="block text-[10px] font-bold text-gray-300 uppercase mb-1 truncate"
                    title={defenderTeamNames}
                  >
                    {defenderTeamNames}
                  </span>
                  <span className="text-3xl font-black">
                    {roundScore.defendingTeam.cardPoints}
                  </span>
                  <span className="block text-[10px] text-gray-400 mt-1">
                    {strings.result.contractPoints}
                  </span>
                </div>
              </div>
            )}

            <div className="mb-4 bg-black/20 rounded-xl p-3 text-left space-y-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-2">
                {strings.result.settlement}
              </p>
              <div className="flex justify-between text-xs">
                <span className="text-gray-300">
                  {strings.result.contract} ({contract?.replace("_", " ")})
                </span>
                <span
                  className={
                    roundScore.contractValue >= 0
                      ? "text-green-400 font-bold"
                      : "text-red-400 font-bold"
                  }
                >
                  {roundScore.contractValue >= 0 ? "+" : ""}
                  {roundScore.contractValue}
                </span>
              </div>
              {hasDifference && (
                <div className="flex justify-between text-xs">
                  <span className="text-gray-300">
                    {strings.result.difference(
                      roundScore.declarerTeam.cardPoints,
                      Math.round(roundScore.declarerTeam.cardPoints / 5) * 5,
                    )}
                  </span>
                  <span className={roundScore.razlika >= 0 ? "text-green-300" : "text-red-300"}>
                    {roundScore.razlika >= 0 ? "+" : ""}
                    {roundScore.razlika}
                  </span>
                </div>
              )}
              {roundScore.bonuses.map((b, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-gray-300 capitalize">
                    {b.announcedBy === "silent"
                      ? strings.result.silent
                      : b.achieved
                        ? strings.result.achieved
                        : strings.result.missed}
                    {b.type.replace(/_/g, " ")}
                    {b.announcedBy !== "silent"
                      ? ` ${strings.result.announcedLabel(b.announcedBy)}`
                      : ` ${strings.result.silentLabel}`}
                  </span>
                  <span
                    className={b.value >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}
                  >
                    {b.value >= 0 ? "+" : ""}
                    {b.value}
                  </span>
                </div>
              ))}
              {currentResult && currentResult.radlciUsed > 0 && (
                <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                  <span className="text-orange-300">
                    {strings.result.radlci(currentResult.radlciUsed)}
                  </span>
                  <span className="text-orange-300 font-bold">
                    ×{Math.pow(2, currentResult.radlciUsed)}
                  </span>
                </div>
              )}
              {roundScore.mondfang < 0 && (
                <div className="flex justify-between text-xs border-t border-white/10 pt-1 mt-1">
                  <span className="text-red-400">{strings.result.mondfang}</span>
                  <span className="text-red-400 font-bold">{roundScore.mondfang}</span>
                </div>
              )}
            </div>
            {roundScore.newRadlciEarned > 0 && (
              <p className="text-purple-300 text-sm mb-3">{strings.result.newRadlc}</p>
            )}
          </>
        )}

        {!isKlop && (
          <div className="mb-6 flex flex-col items-center">
            <span
              className={`text-5xl sm:text-6xl font-black drop-shadow-lg ${
                humanDelta >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {humanDelta >= 0 ? "+" : ""}
              {humanDelta}
            </span>
            <span className="text-sm font-bold text-gray-300 uppercase tracking-widest mt-1">
              {strings.result.yourPoints}
            </span>
          </div>
        )}

        {currentRound < maxRounds ? (
          <button
            type="button"
            onClick={onNextRound}
            className="w-full py-4 bg-yellow-500 text-green-900 font-black text-xl sm:text-2xl rounded-2xl shadow-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
          >
            {strings.result.nextRound}
          </button>
        ) : (
          <button
            type="button"
            onClick={onShowFinalScore}
            className="w-full py-4 bg-yellow-500 text-green-900 font-black text-xl sm:text-2xl rounded-2xl shadow-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
          >
            {strings.result.showFinal}
          </button>
        )}
      </div>
    </div>
  );
}
