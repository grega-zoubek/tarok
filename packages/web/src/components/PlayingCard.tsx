import React, { useState } from "react";
import type { Card, Suit, SuitRank } from "@tarok/engine";
import { cardFaceUrl, CARD_BACK_URL } from "../cards/faceAssets";

interface CardProps {
  card?: Card;
  /** Show the patterned back instead of a face. */
  faceDown?: boolean;
  onClick?: (() => void) | undefined;
  disabled?: boolean;
  className?: string;
  /** Smaller rendering for overlays / talon / open-hand previews. */
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS: Record<NonNullable<CardProps["size"]>, string> = {
  sm: "card-sm",
  md: "card-md",
  lg: "card-lg",
};

const SUIT_NAMES: Record<Suit, string> = {
  hearts: "Srce",
  diamonds: "Kara",
  clubs: "Križ",
  spades: "Pik",
};

const RANK_NAMES: Record<SuitRank, string> = {
  king: "kralj",
  queen: "dama",
  cavalier: "kaval",
  jack: "fant",
  ace: "as",
  two: "2",
  three: "3",
  four: "4",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
};

function cardAccessibleName(card: Card): string {
  if (card.kind === "tarok") {
    const rank =
      card.rank === "skis"
        ? "Škis"
        : card.rank === 1
          ? "Pagat"
          : card.rank === 21
            ? "Mond"
            : card.name.toUpperCase();
    return `Tarok ${rank}`;
  }
  return `${SUIT_NAMES[card.suit]} ${RANK_NAMES[card.rank]}`;
}

/** Keyed by URL so a failed image never hides the next card's artwork. */
function CardArtwork({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);

  return failed ? (
    <span className="card-face-fallback" aria-hidden="true">
      {label}
    </span>
  ) : (
    <img
      src={src}
      alt=""
      draggable={false}
      decoding="async"
      className="card-face-img"
      onError={() => setFailed(true)}
    />
  );
}

export const PlayingCard = React.memo(function PlayingCard({
  card,
  faceDown = false,
  onClick,
  disabled,
  className = "",
  size = "md",
}: CardProps) {
  const showBack = faceDown || card === undefined;
  const src = card && !showBack ? cardFaceUrl(card) : CARD_BACK_URL;
  const label = card && !showBack ? cardAccessibleName(card) : "Hrbtna stran karte";
  const interactive = !disabled && onClick !== undefined;

  return (
    <button
      type="button"
      disabled={!interactive}
      className={`card-face ${SIZE_CLASS[size]} disabled:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-green-900 ${interactive ? "cursor-pointer" : "cursor-default"} ${className}`}
      onClick={interactive ? onClick : undefined}
      aria-label={label}
      title={label}
    >
      <CardArtwork key={src} src={src} label={label} />
    </button>
  );
});
