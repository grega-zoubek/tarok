import type { PlayerId } from "@tarok/engine";
import type { RoundResult } from "../hooks/useTarokGame";
import { strings } from "../lib/strings";

interface ScoreboardProps {
  playerNames: string[];
  playerScores: number[];
  playerRadlci: number[];
  history: RoundResult[];
  currentRound: number;
  maxRounds: number;
  currentSeed: number | null;
  humanPlayer: PlayerId;
  onQuit: () => void;
}

function formatScore(score: number): string {
  if (score === 0) return "—";
  return score > 0 ? `+${score}` : `${score}`;
}

export function Scoreboard({
  playerNames,
  playerScores,
  playerRadlci,
  history,
  currentRound,
  maxRounds,
  currentSeed,
  humanPlayer,
  onQuit,
}: ScoreboardProps) {
  return (
    <aside className="w-full lg:w-64 flex-shrink-0 max-h-[30vh] lg:max-h-none bg-black/40 border-b lg:border-b-0 lg:border-r border-white/10 p-4 flex flex-col backdrop-blur-md">
      <h2 className="text-xl font-black text-yellow-400 mb-4 flex items-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          📊
        </span>{" "}
        {strings.sidebar.title}
      </h2>
      <button
        type="button"
        onClick={onQuit}
        className="mb-4 w-full py-1 text-xs font-bold bg-red-900/40 hover:bg-red-800/60 border border-red-700/50 text-red-300 rounded-lg transition-colors"
        title={strings.sidebar.quitTitle}
      >
        {strings.sidebar.quit}
      </button>

      <div className="flex-grow min-h-0 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
        {history.length === 0 && (
          <p className="text-xs text-gray-500 italic text-center py-8">{strings.sidebar.empty}</p>
        )}
        {history.map((res, i) => {
          const isKlop = res.winnerTeam === "klop";
          const isWin = res.winnerTeam === "declarer";
          const humanDelta = res.perPlayerDelta?.[humanPlayer] ?? 0;
          const rowColor = isKlop
            ? "bg-yellow-900/30 border-yellow-600/30"
            : isWin
              ? "bg-green-900/40 border-green-500/30"
              : "bg-red-900/40 border-red-500/30";
          return (
            <div
              key={i}
              className={`p-3 rounded-lg border flex flex-col gap-1 transition-all hover:scale-[1.02] ${rowColor}`}
            >
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-bold text-gray-400">
                  {strings.sidebar.roundTag(res.round)}
                </span>
                <span
                  className={`text-xs font-black ${
                    humanDelta >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {strings.sidebar.points(humanDelta)}
                </span>
              </div>
              <span className="text-sm font-bold text-yellow-100 uppercase tracking-tighter">
                {strings.sidebar.contract(res.contract)}
              </span>
              <div className="flex justify-between text-[10px] text-gray-300">
                <span>{res.declarer}</span>
                {res.radlciUsed > 0 && (
                  <span className="text-orange-300">
                    🔸{res.radlciUsed} {strings.sidebar.radlc}
                  </span>
                )}
                {res.mondfang < 0 && (
                  <span className="text-red-400">{strings.sidebar.mondfang}</span>
                )}
                {res.newRadlciEarned > 0 && (
                  <span className="text-purple-300">{strings.sidebar.newRadlc}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
        <div className="flex justify-between text-xs font-bold text-gray-400">
          <span>{strings.sidebar.round}</span>
          <span className="text-yellow-400">
            {currentRound} / {maxRounds}
          </span>
        </div>
        {currentSeed !== null && (
          <div
            className="flex justify-between text-[10px] text-gray-500 font-mono"
            title={strings.sidebar.seedTitle}
          >
            <span>{strings.sidebar.seed}</span>
            <span>{currentSeed}</span>
          </div>
        )}

        <div>
          <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">
            {strings.sidebar.totals}
          </div>
          {playerNames.map((name, i) => {
            const score = playerScores[i] ?? 0;
            const radlci = playerRadlci[i] ?? 0;
            const isHuman = i === humanPlayer;
            return (
              <div
                key={i}
                className={`flex justify-between items-center py-[3px] px-1 rounded text-xs ${
                  isHuman ? "bg-yellow-400/10 border border-yellow-400/20" : ""
                }`}
              >
                <span
                  className={`truncate max-w-[100px] font-semibold ${
                    isHuman ? "text-yellow-200" : "text-gray-300"
                  }`}
                >
                  {name}
                  {isHuman ? strings.app.humanMark : ""}
                </span>
                <div className="flex items-center gap-1 ml-1">
                  {radlci > 0 && (
                    <span className="text-orange-400 text-[10px]">
                      {"🔸".repeat(Math.min(radlci, 4))}
                    </span>
                  )}
                  <span
                    className={`font-black text-right min-w-[36px] ${
                      score > 0 ? "text-green-400" : score < 0 ? "text-red-400" : "text-gray-500"
                    }`}
                  >
                    {formatScore(score)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
