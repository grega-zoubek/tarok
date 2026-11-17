import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

/** Native modal semantics, focus containment/restoration, and optional dismissal. */
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    const first = dialog.querySelector<HTMLElement>(
      "button:not(:disabled), input, select, [tabindex='0']",
    );
    (first ?? dialog).focus();
    return () => {
      if (typeof dialog.close === "function") dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={id}
      aria-modal="true"
      tabIndex={-1}
      className="bg-green-900 text-white p-6 rounded-3xl border-4 border-yellow-500 shadow-2xl max-w-lg w-[calc(100%_-_2rem)] max-h-[90vh] overflow-y-auto"
      onCancel={(event) => {
        event.preventDefault();
        onClose?.();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose?.();
        }
        if (event.key !== "Tab") return;
        const elements = Array.from(
          ref.current!.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input, select, [tabindex='0']",
          ),
        );
        const first = elements[0];
        const last = elements[elements.length - 1];
        if (!first) {
          event.preventDefault();
          return;
        }
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last!.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }}
    >
      <h2 id={id} className="text-3xl font-black text-yellow-400 mb-4 text-center">
        {title}
      </h2>
      {children}
    </dialog>,
    document.body,
  );
}
