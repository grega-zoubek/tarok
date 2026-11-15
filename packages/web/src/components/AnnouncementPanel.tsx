import type { AnnouncementType, GameState, PlayerId } from "@tarok/engine";
import { ANNOUNCEMENTS, getAnnouncementError } from "@tarok/engine";
import { strings } from "../lib/strings";

interface AnnouncementPanelProps {
  gameState: GameState;
  playerId: PlayerId;
  onAnnounce: (type: AnnouncementType) => void;
  onPass: () => void;
}

export function AnnouncementPanel({
  gameState,
  playerId,
  onAnnounce,
  onPass,
}: AnnouncementPanelProps) {
  return (
    <div className="bg-black/60 p-6 rounded-2xl border-2 border-yellow-500 shadow-2xl backdrop-blur-md text-center space-y-4">
      <p className="text-yellow-400 font-bold mb-2">{strings.announcements.title}</p>
      <div className="flex flex-wrap justify-center gap-2 max-w-sm">
        {ANNOUNCEMENTS.map((type) => {
          const announceError = getAnnouncementError(gameState, playerId, type);
          const disabled = announceError !== undefined;
          return (
            <button
              key={type}
              type="button"
              disabled={disabled}
              title={announceError}
              onClick={() => onAnnounce(type)}
              className={`px-4 py-2 rounded font-bold text-sm uppercase transition-all ${
                disabled
                  ? "bg-gray-600 opacity-50 cursor-not-allowed"
                  : "bg-purple-600 hover:bg-purple-500"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onPass}
        className="px-6 py-2 bg-red-600 hover:bg-red-500 rounded-lg font-bold w-full mt-4"
      >
        {strings.announcements.finish}
      </button>
    </div>
  );
}
