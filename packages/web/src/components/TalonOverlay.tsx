import type { Card, GameState } from "@tarok/engine";
import { PlayingCard } from "./PlayingCard";
import { strings } from "../lib/strings";

interface BotTalonOverlayProps {
  gameState: GameState;
  playerNames: string[];
}

/** Prikaz botove izbire talona (samo ko je na potezi bot). */
export function BotTalonOverlay({ gameState, playerNames }: BotTalonOverlayProps) {
  const currentName =
    gameState.currentPlayer !== undefined
      ? (playerNames[gameState.currentPlayer] ?? `Igralec ${gameState.currentPlayer}`)
      : "Bot";

  return (
    <div className="absolute inset-0 flex items-center justify-center z-30 bg-black/60 backdrop-blur-sm p-3">
      <div className="bg-black/70 p-4 sm:p-6 rounded-2xl border-2 border-white/20 shadow-2xl text-center max-w-lg w-full">
        <p className="text-yellow-400 font-bold text-lg mb-1 uppercase tracking-widest">
          {currentName} — {strings.talon.title}
        </p>

        {gameState.pickedTalonGroupIndex === undefined ? (
          <>
            <p className="text-gray-400 text-sm mb-4 italic">{strings.talon.choosing}</p>
            <div className="flex justify-center gap-4 sm:gap-6">
              {gameState.talonGroups.map((group, idx) => (
                <div key={idx} className="flex flex-col items-center gap-2 opacity-70">
                  <div className="flex gap-1">
                    {group.map((_card, ci) => (
                      <div
                        key={ci}
                        className="w-12 h-20 bg-green-900/80 border border-green-600 rounded-md flex items-center justify-center shadow-inner"
                      >
                        <span className="text-green-400 opacity-20 text-xl font-black">?</span>
                      </div>
                    ))}
                  </div>
                  <span className="text-xs text-gray-400 font-bold">
                    {strings.talon.group(idx + 1)}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="text-green-300 font-bold text-sm mb-3">
              {strings.talon.tookGroup(gameState.pickedTalonGroupIndex + 1)}
            </p>
            <div className="flex justify-center gap-1 sm:gap-2 mb-4">
              {gameState.talonGroups[gameState.pickedTalonGroupIndex]?.map((card, i) => (
                <div key={i} className="scale-90 sm:scale-110">
                  <PlayingCard card={card} disabled />
                </div>
              ))}
            </div>
            <div className="flex flex-col items-center gap-1 opacity-40">
              <p className="text-[10px] text-gray-400 uppercase">
                {strings.talon.restToDefenders}
              </p>
              <div className="flex gap-1 justify-center">
                {gameState.talonGroups.map((group, gIdx) => {
                  if (gIdx === gameState.pickedTalonGroupIndex) return null;
                  return group.map((card, cIdx) => (
                    <div key={`${gIdx}-${cIdx}`} className="scale-[0.55] -mx-6 sm:-mx-5">
                      <PlayingCard card={card} disabled />
                    </div>
                  ));
                })}
              </div>
            </div>
            <p className="text-gray-500 text-xs italic mt-3">{strings.talon.botDiscarding}</p>
          </>
        )}
      </div>
    </div>
  );
}

interface HumanTalonPanelProps {
  gameState: GameState;
  exchangeCount: number;
  requiredTalonGroup: number | undefined;
  selectedDiscards: readonly Card[];
  onPick: (groupIndex: number) => void;
  onConfirmDiscard: () => void;
}

/** Talon koraki, ko je na potezi človek. */
export function HumanTalonPanel({
  gameState,
  exchangeCount,
  requiredTalonGroup,
  selectedDiscards,
  onPick,
  onConfirmDiscard,
}: HumanTalonPanelProps) {
  if (gameState.pickedTalonGroupIndex === undefined) {
    return (
      <div className="bg-black/60 p-4 sm:p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md flex flex-col gap-4 max-w-full">
        <p className="text-yellow-400 font-bold text-center uppercase tracking-widest">
          {strings.talon.chooseGroup}
        </p>
        {requiredTalonGroup !== undefined && (
          <p className="text-center text-xs text-blue-300">{strings.talon.requiredKing}</p>
        )}
        <div className="flex gap-2 sm:gap-6 justify-center">
          {gameState.talonGroups.map((group, idx) => {
            const locked = requiredTalonGroup !== undefined && requiredTalonGroup !== idx;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onPick(idx)}
                disabled={locked}
                className={`group relative ${locked ? "opacity-30 cursor-not-allowed" : ""}`}
              >
                <div className="flex flex-col items-center">
                  <div className="flex -space-x-12 mb-4 group-hover:-space-x-2 transition-all duration-300">
                    {group.map((card, ci) => (
                      <div
                        key={ci}
                        className="transform group-hover:scale-105 transition-transform"
                      >
                        <PlayingCard card={card} disabled />
                      </div>
                    ))}
                  </div>
                  <div className="px-3 sm:px-6 py-2 bg-purple-600 group-hover:bg-purple-500 rounded-full font-black text-sm sm:text-xl border-2 border-purple-400 shadow-lg">
                    {strings.talon.groupButton(idx + 1)}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black/60 p-4 sm:p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-4 max-w-full">
      <p className="text-yellow-400 font-bold uppercase tracking-widest">
        {strings.talon.yourGroup}
      </p>
      <div className="flex justify-center gap-1 sm:gap-4 py-4 bg-white/5 rounded-xl border border-white/10">
        {gameState.talonGroups[gameState.pickedTalonGroupIndex]?.map((card, i) => (
          <div key={i} className="transform scale-90 sm:scale-110">
            <PlayingCard card={card} disabled />
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 opacity-50">
        <p className="text-[10px] text-gray-400 uppercase">{strings.talon.restOfTalon}</p>
        <div className="flex gap-1 sm:gap-2">
          {gameState.talonGroups.map((group, gIdx) => {
            if (gIdx === gameState.pickedTalonGroupIndex) return null;
            return group.map((card, cIdx) => (
              <div key={`${gIdx}-${cIdx}`} className="scale-50 -mx-8">
                <PlayingCard card={card} disabled />
              </div>
            ));
          })}
        </div>
      </div>

      <div className="pt-4 border-t border-white/10">
        <p className="text-sm text-yellow-100 font-medium mb-4 italic">
          {strings.talon.pickCards(exchangeCount)}
        </p>
        <button
          type="button"
          disabled={selectedDiscards.length !== exchangeCount}
          onClick={onConfirmDiscard}
          className={`w-full py-4 rounded-xl font-black text-lg sm:text-xl transition-all ${
            selectedDiscards.length === exchangeCount
              ? "bg-green-600 hover:bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:scale-[1.02]"
              : "bg-gray-700 opacity-50 cursor-not-allowed"
          }`}
        >
          {strings.talon.confirm} ({selectedDiscards.length})
        </button>
      </div>
    </div>
  );
}
