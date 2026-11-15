import type { BiddingAction } from "@tarok/engine";
import { PASS } from "@tarok/engine";
import { strings } from "../lib/strings";

interface BiddingPanelProps {
  legalBids: readonly BiddingAction[];
  onBid: (action: BiddingAction) => void;
}

export function BiddingPanel({ legalBids, onBid }: BiddingPanelProps) {
  return (
    <div className="flex flex-wrap justify-center gap-3 pointer-events-auto bg-black/60 py-10 sm:py-20 px-6 sm:px-8 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md mb-4">
      <p className="w-full text-center text-yellow-400 font-bold mb-3 text-xl">
        {strings.bidding.title}
      </p>
      {legalBids.map((bid) => (
        <button
          key={bid}
          type="button"
          onClick={() => onBid(bid)}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-base uppercase"
        >
          {bid.replace("_", " ")}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onBid(PASS)}
        className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded font-bold text-base uppercase w-full mt-3"
      >
        {strings.bidding.pass}
      </button>
    </div>
  );
}
