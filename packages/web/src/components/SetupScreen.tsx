import React, { useState } from "react";
import type { BotDifficulty } from "@tarok/ai";
import type { GameSettings } from "../hooks/useTarokGame";

export function SetupScreen({ onStart }: { onStart: (settings: GameSettings) => void }) {
  const [humanName, setHumanName] = useState("Igralec");
  const [maxRounds, setMaxRounds] = useState(8);
  const [bots, setBots] = useState<GameSettings["botConfigs"]>([
    { name: "Bot 1", difficulty: 3 },
    { name: "Bot 2", difficulty: 3 },
    { name: "Bot 3", difficulty: 3 },
  ]);
  return (
    <main className="flex items-center justify-center min-h-screen bg-green-900">
      <form
        className="bg-green-800 p-8 rounded-xl shadow-2xl border-4 border-yellow-600 w-full max-w-md overflow-y-auto max-h-screen text-white"
        onSubmit={(event) => {
          event.preventDefault();
          onStart({ humanName: humanName.trim() || "Igralec", botConfigs: bots, maxRounds });
        }}
      >
        <h1 className="text-6xl font-bold mb-8 text-yellow-400 text-center font-serif">TAROK</h1>
        <div className="space-y-4 mb-8">
          <div>
            <label htmlFor="human-name" className="block text-sm font-bold text-yellow-200 mb-1">
              Tvoje ime:
            </label>
            <input
              id="human-name"
              maxLength={80}
              value={humanName}
              onChange={(e) => setHumanName(e.target.value)}
              className="w-full p-2 rounded bg-green-700 border border-yellow-600"
            />
          </div>
          <fieldset>
            <legend className="text-sm font-bold text-yellow-200 mb-1">
              Dolžina igre (št. krogov):
            </legend>
            <div className="flex gap-2">
              {[8, 12, 16].map((n) => (
                <button
                  type="button"
                  key={n}
                  aria-pressed={maxRounds === n}
                  onClick={() => setMaxRounds(n)}
                  className={`flex-grow py-2 rounded font-bold border ${maxRounds === n ? "bg-yellow-500 text-green-900 border-white" : "bg-green-700 text-yellow-200 border-yellow-600"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </fieldset>
          {bots.map((bot, i) => (
            <div key={i} className="flex gap-2 p-2 bg-black/10 rounded border border-white/5">
              <div className="flex-grow min-w-0">
                <label
                  htmlFor={`bot-name-${i}`}
                  className="block text-xs font-bold text-gray-300 mb-1"
                >
                  Nasprotnik {i + 1}:
                </label>
                <input
                  id={`bot-name-${i}`}
                  maxLength={80}
                  value={bot.name}
                  onChange={(e) =>
                    setBots((current) =>
                      current.map((b, index) => (index === i ? { ...b, name: e.target.value } : b)),
                    )
                  }
                  className="w-full p-1 text-sm rounded bg-green-700 border border-gray-500"
                />
              </div>
              <div className="w-24">
                <label
                  htmlFor={`bot-level-${i}`}
                  className="block text-xs font-bold text-gray-300 mb-1"
                >
                  Moč {i + 1}:
                </label>
                <select
                  id={`bot-level-${i}`}
                  value={bot.difficulty}
                  onChange={(e) =>
                    setBots((current) =>
                      current.map((b, index) =>
                        index === i
                          ? { ...b, difficulty: Number(e.target.value) as BotDifficulty }
                          : b,
                      ),
                    )
                  }
                  className="w-full p-1 text-sm rounded bg-green-700 border border-gray-500"
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <option key={level} value={level}>
                      {level === 1 ? "1 (Šibko)" : level === 5 ? "5 (Mojster)" : level}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>
        <button
          type="submit"
          className="w-full py-4 bg-yellow-500 text-green-900 font-bold rounded-lg shadow-lg text-2xl hover:bg-yellow-400"
        >
          Igraj!
        </button>
      </form>
    </main>
  );
}
