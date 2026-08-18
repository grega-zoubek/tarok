import React from 'react';
import { type Card } from '@tarok/engine';

interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
}

export function PlayingCard({ card, onClick, disabled }: CardProps) {
  let display = "";
  let colorClass = "card-black";

  if (card.kind === "tarok") {
    colorClass = "card-tarok";
    display = card.rank === "skis" ? "Škis" : card.rank.toString();
  } else {
    colorClass = (card.suit === "hearts" || card.suit === "diamonds") ? "card-suit" : "card-black";
    const suitSymbol = {
      hearts: "♥",
      diamonds: "♦",
      spades: "♠",
      clubs: "♣"
    }[card.suit];

    let rankDisplay: string | number = card.rank;
    switch (card.rank) {
      case "king": rankDisplay = "K"; break;
      case "queen": rankDisplay = "Q"; break;
      case "cavalier": rankDisplay = "C"; break;
      case "jack": rankDisplay = "J"; break;
      case "ace": rankDisplay = "A"; break;
    }

    display = `${rankDisplay} ${suitSymbol}`;
  }

  return (
    <div 
      className={`card ${colorClass} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer hover:-translate-y-2 transition-transform"}`}
      onClick={!disabled ? onClick : undefined}
    >
      <div className="text-sm">{display}</div>
      <div className="text-3xl text-center flex-grow flex items-center justify-center">
        {card.kind === "suit" ? (card.suit === "hearts" || card.suit === "diamonds" ? "♥♦"[card.suit === "hearts" ? 0 : 1] : "♠♣"[card.suit === "spades" ? 0 : 1]) : "★"}
      </div>
      <div className="text-sm text-right rotate-180">{display}</div>
    </div>
  );
}