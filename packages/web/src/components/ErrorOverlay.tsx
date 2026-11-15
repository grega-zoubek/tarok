import { strings } from "../lib/strings";

interface ErrorOverlayProps {
  message: string;
  onClose: () => void;
}

export function ErrorOverlay({ message, onClose }: ErrorOverlayProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-red-900 border-4 border-red-500 rounded-2xl p-8 shadow-2xl max-w-md mx-4 animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={strings.errors.title}
      >
        <div className="text-center">
          <div className="text-6xl mb-4" aria-hidden="true">
            ⚠️
          </div>
          <h3 className="text-2xl font-black text-red-200 mb-4">{strings.errors.title}</h3>
          <p className="text-red-100 text-lg mb-6">{message}</p>
          <button
            type="button"
            onClick={onClose}
            className="px-8 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-colors"
          >
            {strings.errors.ok}
          </button>
        </div>
      </div>
    </div>
  );
}
