import { useState } from "react";
import type { BotDifficulty } from "@tarok/ai";
import type { BotConfig, GameSettings } from "../hooks/useTarokGame";
import { strings } from "../lib/strings";

interface SetupScreenProps {
  onStart: (settings: GameSettings) => void;
}

const DEFAULT_BOTS: BotConfig[] = [
  { name: "Bot 1", difficulty: 3 },
  { name: "Bot 2", difficulty: 3 },
  { name: "Bot 3", difficulty: 3 },
];

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [humanName, setHumanName] = useState<string>(strings.setup.defaultName);
  const [setupMaxRounds, setSetupMaxRounds] = useState(8);
  const [botConfigs, setBotConfigs] = useState<BotConfig[]>(DEFAULT_BOTS);

  return (
    <div className="flex items-center justify-center min-h-screen bg-green-900 p-4">
      <div className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 w-full max-w-md overflow-y-auto max-h-screen">
        <h1 className="text-6xl font-bold mb-8 text-yellow-400 drop-shadow-lg text-center font-serif">
          {strings.app.title}
        </h1>

        <div className="space-y-4 mb-8 text-left">
          <div>
            <label htmlFor="human-name" className="block text-sm font-bold text-yellow-200 mb-1">
              {strings.setup.nameLabel}
            </label>
            <input
              id="human-name"
              type="text"
              value={humanName}
              onChange={(e) => setHumanName(e.target.value)}
              className="w-full p-2 rounded bg-green-700 text-white border border-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>

          <div>
            <span className="block text-sm font-bold text-yellow-200 mb-1">
              {strings.setup.roundsLabel}
            </span>
            <div className="flex gap-2">
              {[8, 12, 16].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSetupMaxRounds(num)}
                  aria-pressed={setupMaxRounds === num}
                  className={`flex-grow py-2 rounded font-bold border transition-colors ${
                    setupMaxRounds === num
                      ? "bg-yellow-500 text-green-900 border-white"
                      : "bg-green-700 text-yellow-200 border-yellow-600"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>

          {botConfigs.map((bot, idx) => (
            <div key={idx} className="flex gap-2 p-2 bg-black/10 rounded border border-white/5">
              <div className="flex-grow">
                <label
                  htmlFor={`bot-name-${idx}`}
                  className="block text-xs font-bold text-gray-300 mb-1"
                >
                  {strings.setup.opponentLabel(idx)}
                </label>
                <input
                  id={`bot-name-${idx}`}
                  type="text"
                  value={bot.name}
                  onChange={(e) => {
                    setBotConfigs((current) =>
                      current.map((config, index) =>
                        index === idx ? { ...config, name: e.target.value } : config,
                      ),
                    );
                  }}
                  className="w-full p-1 text-sm rounded bg-green-700 text-white border border-gray-500"
                />
              </div>
              <div className="w-24">
                <label
                  htmlFor={`bot-strength-${idx}`}
                  className="block text-xs font-bold text-gray-300 mb-1"
                >
                  {strings.setup.strengthLabel}
                </label>
                <select
                  id={`bot-strength-${idx}`}
                  value={bot.difficulty}
                  onChange={(e) => {
                    const difficulty = Number(e.target.value) as BotDifficulty;
                    setBotConfigs((current) =>
                      current.map((config, index) =>
                        index === idx ? { ...config, difficulty } : config,
                      ),
                    );
                  }}
                  className="w-full p-1 text-sm rounded bg-green-700 text-white border border-gray-500"
                >
                  {([1, 2, 3, 4, 5] as const).map((level) => (
                    <option key={level} value={level}>
                      {strings.setup.levels[level]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onStart({ humanName, botConfigs, maxRounds: setupMaxRounds })}
          className="w-full py-4 bg-yellow-500 text-green-900 font-bold rounded-lg shadow-lg hover:bg-yellow-400 text-2xl transition-all hover:scale-105 active:scale-95"
        >
          {strings.setup.play}
        </button>
      </div>
    </div>
  );
}
