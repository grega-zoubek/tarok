import type { Card } from "@tarok/engine";
import { cardsEqual } from "@tarok/engine";
import { PlayingCard } from "./PlayingCard";

interface HandProps {
  cards: readonly Card[];
  isMyTurn: boolean;
  selectedDiscards: readonly Card[];
  status: string;
  statusActive: boolean;
  onCardClick: (card: Card) => void;
}

export function Hand({
  cards,
  isMyTurn,
  selectedDiscards,
  status,
  statusActive,
  onCardClick,
}: HandProps) {
  return (
    <div className="relative flex flex-col items-center justify-end pb-2">
      <div
        className={`mb-2 px-6 py-1 rounded-full text-xs sm:text-sm font-bold border-2 transition-all ${
          statusActive
            ? "bg-yellow-400 text-green-900 border-white animate-pulse"
            : "bg-black/40 text-white/50 border-white/10"
        }`}
      >
        {status}
      </div>
      <div className="w-full overflow-x-auto pb-2">
        <div
          className="flex justify-center items-end min-w-max mx-auto px-4"
          style={{ gap: cards.length > 10 ? "-20px" : "2px" }}
        >
          {cards.map((card, idx) => {
            const isSelected = selectedDiscards.some((c) => cardsEqual(c, card));
            return (
              <div
                key={idx}
                style={{ marginLeft: cards.length > 8 ? "-28px" : "2px" }}
                className={`transition-all duration-200 transform flex-shrink-0 ${
                  isSelected
                    ? "-translate-y-10 scale-105 z-50 drop-shadow-xl"
                    : isMyTurn
                      ? "hover:-translate-y-8 hover:scale-105 hover:z-40 cursor-pointer"
                      : ""
                }`}
              >
                <PlayingCard
                  card={card}
                  disabled={!isMyTurn}
                  onClick={() => onCardClick(card)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
