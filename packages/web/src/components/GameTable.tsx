import type {
  AnnouncementType,
  BiddingAction,
  Card,
  CapturedTrick,
  GameState,
  PlayerId,
  Suit,
} from "@tarok/engine";
import {
  PASS,
  getLegalBidsForState,
  isTarokCard,
  getCallableSuits,
} from "@tarok/engine";
import { PlayingCard } from "./PlayingCard";
import { PlayerSeat, type SeatPosition } from "./PlayerSeat";
import { BiddingPanel } from "./BiddingPanel";
import { CallingPanel } from "./CallingPanel";
import { AnnouncementPanel } from "./AnnouncementPanel";
import { BotTalonOverlay, HumanTalonPanel } from "./TalonOverlay";
import { strings } from "../lib/strings";

interface GameTableProps {
  gameState: GameState;
  playerNames: string[];
  humanPlayer: PlayerId;
  isMyTurn: boolean;
  isProcessingTrick: boolean;
  isMovingCards: boolean;
  showKlopTalon: boolean;
  lastCapturedTrick: CapturedTrick | null;
  requiredTalonGroup: number | undefined;
  exchangeCount: number;
  selectedDiscards: readonly Card[];
  onBid: (action: BiddingAction) => void;
  onCall: (suit: Suit) => void;
  onTalonPick: (groupIndex: number) => void;
  onDiscardConfirm: () => void;
  onAnnounce: (type: AnnouncementType) => void;
  onAnnouncePass: () => void;
}

function getPlayerPosition(id: PlayerId, humanPlayer: PlayerId): SeatPosition {
  const pos = (id - humanPlayer + 4) % 4;
  switch (pos) {
    case 0:
      return "bottom";
    case 1:
      return "right";
    case 2:
      return "top";
    default:
      return "left";
  }
}

function trickTranslate(position: SeatPosition): string {
  switch (position) {
    case "bottom":
      return "translate-y-16 sm:translate-y-24";
    case "top":
      return "-translate-y-16 sm:-translate-y-24";
    case "left":
      return "-translate-x-16 sm:-translate-x-24";
    case "right":
      return "translate-x-16 sm:translate-x-24";
  }
}

function trickFly(position: SeatPosition): string {
  switch (position) {
    case "bottom":
      return "translate-y-[300px] sm:translate-y-[400px] opacity-0 scale-50";
    case "top":
      return "-translate-y-[300px] sm:-translate-y-[400px] opacity-0 scale-50";
    case "left":
      return "-translate-x-[300px] sm:-translate-x-[400px] opacity-0 scale-50";
    case "right":
      return "translate-x-[300px] sm:translate-x-[400px] opacity-0 scale-50";
  }
}

export function GameTable({
  gameState,
  playerNames,
  humanPlayer,
  isMyTurn,
  isProcessingTrick,
  isMovingCards,
  showKlopTalon,
  lastCapturedTrick,
  requiredTalonGroup,
  exchangeCount,
  selectedDiscards,
  onBid,
  onCall,
  onTalonPick,
  onDiscardConfirm,
  onAnnounce,
  onAnnouncePass,
}: GameTableProps) {
  const legalBids = getLegalBidsForState(gameState);
  const callableSuits = getCallableSuits(gameState);
  const announcements = gameState.announcementsRound?.announcements;
  const hasAnnouncements =
    announcements !== undefined &&
    Object.values(announcements).flat().length > 0;

  return (
    <>
      <div className="flex justify-between items-center bg-black/30 p-2 sm:p-3 rounded-lg mb-3 sm:mb-4 border border-white/10 backdrop-blur-sm gap-2">
        <div className="flex flex-col">
          <span className="text-yellow-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            {strings.table.phase}
          </span>
          <span className="text-sm sm:text-lg font-bold">
            {gameState.phase === "playing"
              ? strings.table.playing
              : gameState.phase.toUpperCase()}
          </span>
        </div>

        <div className="flex gap-2 sm:gap-4 items-center flex-wrap justify-center">
          <div className="text-center bg-yellow-500/10 px-2 sm:px-4 py-1 rounded-full border border-yellow-500/20">
            <span className="text-yellow-400 text-[10px] sm:text-xs block font-bold">
              {strings.table.contract}
            </span>
            <span className="text-xs sm:text-sm font-black text-white">
              {gameState.contract?.toUpperCase() || "..."}
            </span>
          </div>

          {gameState.calledKing && (
            <div className="text-center bg-blue-500/10 px-2 sm:px-4 py-1 rounded-full border border-blue-500/20">
              <span className="text-blue-400 text-[10px] sm:text-xs block font-bold">
                {strings.table.calledKing}
              </span>
              <span className="text-xs sm:text-sm font-black text-white capitalize">
                {gameState.calledKing.suit}{" "}
                {gameState.calledKing.suit === "hearts"
                  ? "♥"
                  : gameState.calledKing.suit === "diamonds"
                    ? "♦"
                    : gameState.calledKing.suit === "clubs"
                      ? "♣"
                      : "♠"}
              </span>
            </div>
          )}

          {hasAnnouncements && announcements && (
            <div className="text-center bg-purple-500/10 px-2 sm:px-4 py-1 rounded-full border border-purple-500/20">
              <span className="text-purple-400 text-[10px] sm:text-xs block font-bold">
                {strings.table.announcements}
              </span>
              <div className="flex gap-1">
                {Object.entries(announcements).map(([pid, ann]) =>
                  ann.map((a, i) => (
                    <span
                      key={`${pid}-${i}`}
                      className="text-[10px] bg-purple-600 px-1 rounded text-white font-bold uppercase"
                      title={playerNames[parseInt(pid)]}
                    >
                      {a.type.replace("_", " ")}
                    </span>
                  )),
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col text-right">
          <span className="text-yellow-400 text-[10px] sm:text-xs font-bold uppercase tracking-wider">
            {strings.table.turn}
          </span>
          <span className="text-sm sm:text-lg font-bold text-yellow-300">
            {gameState.currentPlayer !== undefined
              ? playerNames[gameState.currentPlayer]
              : strings.table.nobody}
          </span>
        </div>
      </div>

      <div className="flex-grow relative flex items-center justify-center">
        <div className="w-[min(500px,80vw,45vh)] sm:w-[min(500px,80vw,55vh)] lg:w-[500px] aspect-square max-h-full bg-green-700/50 rounded-full border-8 sm:border-[12px] border-green-900 shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] relative flex items-center justify-center">
          {gameState.playerOrder.map((id) => {
            const position = getPlayerPosition(id, humanPlayer);
            const isCurrent = gameState.currentPlayer === id;
            const lastBid = [...gameState.bids].reverse().find((b) => b.playerId === id);
            const isPartner = Boolean(
              gameState.teams?.declarerTeam.includes(id) && id !== gameState.declarer,
            );
            const playedCalledKing = (
              plays: readonly { playerId: PlayerId; card: Card }[],
            ) =>
              plays.some(
                (p) =>
                  p.playerId === id &&
                  !isTarokCard(p.card) &&
                  p.card.rank === "king" &&
                  p.card.suit === gameState.calledKing?.suit,
              );
            const hasPlayedCalledKing =
              isPartner &&
              (Boolean(
                gameState.trickRound?.capturedTricks.some((ct) =>
                  playedCalledKing(ct.trick.plays),
                ),
              ) ||
                (gameState.trickRound?.currentTrick
                  ? playedCalledKing(gameState.trickRound.currentTrick.plays)
                  : false));

            const shouldShowBid =
              gameState.phase !== "playing" &&
              gameState.phase !== "finished" &&
              lastBid !== undefined;
            const bidToShow = shouldShowBid ? lastBid : undefined;

            return (
              <PlayerSeat
                key={id}
                position={position}
                name={playerNames[id] ?? `Igralec ${id}`}
                isCurrent={isCurrent}
                isDeclarer={gameState.declarer === id}
                hasPlayedCalledKing={hasPlayedCalledKing}
                bidAction={bidToShow?.action}
                isPass={bidToShow?.action === PASS}
              />
            );
          })}

          {(gameState.contract === "berac" || gameState.contract === "odprti_berac") && (
            <div className="absolute w-24 h-24 sm:w-32 sm:h-32 bg-red-900/10 rounded-full border border-red-500/5 flex items-center justify-center pointer-events-none">
              <span
                className="text-[32px] sm:text-[40px] opacity-10 font-black text-white select-none"
                aria-hidden="true"
              >
                {strings.table.noTricks}
              </span>
            </div>
          )}

          <div className="relative w-full h-full flex items-center justify-center">
            {gameState.contract === "klop" &&
              gameState.trickRound &&
              (() => {
                const capturedN = gameState.trickRound.capturedTricks.length;
                if (!isProcessingTrick || !showKlopTalon) return null;

                const talonIdx = capturedN - 1;
                const talonCard =
                  talonIdx >= 0 && talonIdx < 6 ? gameState.talon[talonIdx] : undefined;
                if (!talonCard) return null;

                return (
                  <div className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 z-20 transition-all duration-700 ease-out top-1/2 -translate-y-1/2 scale-100 opacity-100">
                    <span className="text-[9px] font-black text-yellow-300 bg-black/60 px-2 py-0.5 rounded-full mb-1">
                      {strings.table.talonCard(talonIdx + 1)}
                    </span>
                    <PlayingCard card={talonCard} disabled />
                  </div>
                );
              })()}

            {(isProcessingTrick
              ? (lastCapturedTrick?.trick.plays ?? [])
              : (gameState.trickRound?.currentTrick?.plays ?? [])
            ).map((play, idx) => {
              const position = getPlayerPosition(play.playerId, humanPlayer);
              const positionStyles =
                isMovingCards && lastCapturedTrick
                  ? trickFly(getPlayerPosition(lastCapturedTrick.winner, humanPlayer))
                  : trickTranslate(position);

              return (
                <div
                  key={`${idx}-${play.playerId}`}
                  className={`absolute transition-all duration-[1500ms] ease-in-out z-10 ${positionStyles}`}
                >
                  <PlayingCard card={play.card} disabled />
                </div>
              );
            })}
          </div>

          {gameState.phase === "talon" &&
            !isMyTurn &&
            gameState.talonGroups.length > 0 && (
              <BotTalonOverlay gameState={gameState} playerNames={playerNames} />
            )}

          {isMyTurn && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none flex-col">
              {gameState.phase === "bidding" && (
                <BiddingPanel legalBids={legalBids} onBid={onBid} />
              )}

              <div className="pointer-events-auto max-w-full">
                {gameState.phase === "calling" && (
                  <CallingPanel callableSuits={callableSuits} onCall={onCall} />
                )}

                {gameState.phase === "announcements" && (
                  <AnnouncementPanel
                    gameState={gameState}
                    playerId={humanPlayer}
                    onAnnounce={onAnnounce}
                    onPass={onAnnouncePass}
                  />
                )}

                {gameState.phase === "talon" && (
                  <HumanTalonPanel
                    gameState={gameState}
                    exchangeCount={exchangeCount}
                    requiredTalonGroup={requiredTalonGroup}
                    selectedDiscards={selectedDiscards}
                    onPick={onTalonPick}
                    onConfirmDiscard={onDiscardConfirm}
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
