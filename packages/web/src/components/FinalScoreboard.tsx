import type { PlayerId } from "@tarok/engine";
import type { RoundResult } from "../hooks/useTarokGame";
import { strings } from "../lib/strings";

interface FinalScoreboardProps {
  playerNames: string[];
  playerScores: number[];
  history: RoundResult[];
  maxRounds: number;
  humanPlayer: PlayerId;
  onNewGame: () => void;
}

function formatScore(score: number): string {
  return score >= 0 ? `+${score}` : `${score}`;
}

export function FinalScoreboard({
  playerNames,
  playerScores,
  history,
  maxRounds,
  humanPlayer,
  onNewGame,
}: FinalScoreboardProps) {
  const ranking = playerNames
    .map((name, index) => ({ name, score: playerScores[index] ?? 0 }))
    .sort((a, b) => b.score - a.score);
  const leader = ranking[0];
  const leaderScore = leader?.score ?? 0;
  const wins = history.filter((r) => r.winnerTeam === "declarer").length;

  return (
    <div className="flex items-center justify-center min-h-screen bg-green-900 p-4">
      <div className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 w-full max-w-md overflow-y-auto max-h-screen">
        <h1 className="text-4xl font-black text-yellow-400 mb-2 text-center">
          {strings.finalScore.title}
        </h1>
        <p className="text-center text-gray-300 mb-6 text-sm">
          {strings.finalScore.roundsPlayed(maxRounds)}
        </p>

        <div
          className={`text-center mb-6 p-4 rounded-2xl border-2 ${
            leaderScore >= 0
              ? "bg-green-700/50 border-green-400"
              : "bg-red-900/50 border-red-400"
          }`}
        >
          <span
            className={`text-6xl font-black ${
              leaderScore >= 0 ? "text-green-300" : "text-red-300"
            }`}
          >
            {formatScore(leaderScore)}
          </span>
          <p className="text-sm text-gray-300 mt-1 uppercase tracking-widest">
            {strings.finalScore.winner(leader?.name)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {strings.finalScore.winsLosses(wins, maxRounds - wins)}
          </p>
        </div>

        <div className="space-y-1 mb-6">
          {ranking.map((entry, i) => (
            <div
              key={entry.name}
              className="flex justify-between items-center p-2 rounded-lg text-sm bg-black/20 border border-white/10"
            >
              <span className="text-gray-400 text-xs w-6">{i + 1}.</span>
              <span
                className={`flex-1 font-bold ${
                  i === 0 ? "text-yellow-200" : "text-gray-200"
                }`}
              >
                {entry.name}
              </span>
              <span
                className={`font-black ${entry.score >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {formatScore(entry.score)}
              </span>
            </div>
          ))}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto mb-6">
          {history.map((r, i) => {
            const humanDelta = r.perPlayerDelta?.[humanPlayer] ?? 0;
            return (
              <div
                key={i}
                className={`flex justify-between items-center p-2 rounded-lg text-sm border ${
                  r.winnerTeam === "declarer"
                    ? "bg-green-900/40 border-green-700"
                    : r.winnerTeam === "klop"
                      ? "bg-yellow-900/30 border-yellow-700"
                      : "bg-red-900/40 border-red-800"
                }`}
              >
                <span className="text-gray-400 text-xs w-8">#{r.round}</span>
                <span className="text-yellow-100 uppercase font-bold flex-1">
                  {strings.sidebar.contract(r.contract)}
                </span>
                <span className="text-gray-300 text-xs">{r.declarer}</span>
                <span
                  className={`font-black ml-3 ${
                    humanDelta >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatScore(humanDelta)}
                </span>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onNewGame}
          className="w-full py-4 bg-yellow-500 text-green-900 font-black text-xl rounded-xl hover:bg-yellow-400 hover:scale-105 active:scale-95 transition-all"
        >
          {strings.finalScore.newGame}
        </button>
      </div>
    </div>
  );
}
