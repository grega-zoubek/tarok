import type { Suit } from "@tarok/engine";
import { suitSymbol } from "../lib/card-display";
import { strings } from "../lib/strings";

interface CallingPanelProps {
  callableSuits: readonly Suit[];
  onCall: (suit: Suit) => void;
}

export function CallingPanel({ callableSuits, onCall }: CallingPanelProps) {
  return (
    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md flex flex-wrap justify-center gap-3">
      <p className="w-full text-center text-yellow-400 font-bold mb-2">{strings.calling.title}</p>
      {callableSuits.map((suit) => (
        <button
          key={suit}
          type="button"
          onClick={() => onCall(suit)}
          aria-label={strings.calling.callSuit(suitSymbol(suit))}
          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          <span className="text-4xl" aria-hidden="true">
            {suitSymbol(suit)}
          </span>
        </button>
      ))}
    </div>
  );
}
