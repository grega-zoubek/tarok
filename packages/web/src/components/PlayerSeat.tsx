import { strings } from "../lib/strings";

export type SeatPosition = "top" | "bottom" | "left" | "right";

const LAYOUTS: Record<SeatPosition, string> = {
  top: "top-[-48px] sm:top-[-60px] flex-col-reverse",
  bottom: "bottom-[-48px] sm:bottom-[-60px] flex-col",
  left: "left-[-70px] sm:left-[-120px] flex-row-reverse",
  right: "right-[-70px] sm:right-[-120px] flex-row",
};

interface PlayerSeatProps {
  position: SeatPosition;
  name: string;
  isCurrent: boolean;
  isDeclarer: boolean;
  hasPlayedCalledKing: boolean;
  bidAction: string | undefined;
  isPass: boolean;
}

export function PlayerSeat({
  position,
  name,
  isCurrent,
  isDeclarer,
  hasPlayedCalledKing,
  bidAction,
  isPass,
}: PlayerSeatProps) {
  return (
    <div className={`flex items-center justify-center absolute gap-2 ${LAYOUTS[position]}`}>
      <div
        className={`font-black text-base sm:text-xl tracking-tighter transition-all duration-300 drop-shadow-md ${
          isCurrent
            ? "text-yellow-400 scale-110 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]"
            : "text-white opacity-80"
        }`}
      >
        {name}
        {isDeclarer ? (
          <span className="ml-1 text-yellow-500 text-sm">{strings.table.declarerMark}</span>
        ) : (
          ""
        )}
        {hasPlayedCalledKing ? <span className="ml-1">{strings.table.calledKingMark}</span> : ""}
      </div>

      {bidAction !== undefined && (
        <div
          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase shadow-lg border transition-all ${
            bidAction === undefined
              ? ""
              : isPass
                ? "bg-red-950/60 text-red-400 border-red-500/30"
                : "bg-blue-700 text-white border-blue-400 animate-pulse"
          }`}
        >
          {bidAction.replace("_", " ")}
        </div>
      )}
    </div>
  );
}
