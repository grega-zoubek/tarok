import React, { useState } from "react";
import { type Card } from "@tarok/engine";
import { cardFaceUrl, CARD_BACK_URL } from "../cards/faceAssets";

interface CardProps {
  card?: Card;
  /** Show the patterned back instead of a face. */
  faceDown?: boolean;
  onClick?: () => void;
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

export function PlayingCard({
  card,
  faceDown = false,
  onClick,
  disabled,
  className = "",
  size = "md",
}: CardProps) {
  const [failed, setFailed] = useState(false);
  const showBack = faceDown || !card;
  const src = showBack ? CARD_BACK_URL : cardFaceUrl(card!);

  return (
    <div
      className={`card-face ${SIZE_CLASS[size]} ${disabled ? "cursor-default" : "cursor-pointer"} ${className}`}
      onClick={!disabled ? onClick : undefined}
      role={onClick && !disabled ? "button" : undefined}
      aria-label={
        showBack
          ? "Hrbtna stran karte"
          : card!.kind === "tarok"
            ? `Tarok ${card!.rank === "skis" ? "Škis" : card!.rank}`
            : `${card!.rank} ${card!.suit}`
      }
    >
      {!failed ? (
        <img
          src={src}
          alt=""
          draggable={false}
          className="card-face-img"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="card-face-fallback">
          {showBack ? "?" : card!.kind === "tarok" ? String(card!.rank) : `${card!.rank[0]}`}
        </div>
      )}
    </div>
  );
}
