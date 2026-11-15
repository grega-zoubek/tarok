import React from 'react';
import { type Card, type TarokCard } from '@tarok/engine';
import { RANK_DISPLAY, SUIT_DISPLAY } from '../lib/card-display';

interface CardProps {
  card: Card;
  onClick?: (() => void) | undefined;
  disabled?: boolean;
}

/** Riterska oznaka za vogal karte (I..XXI, 0 za škisa). */
function tarokRankLabel(card: TarokCard): string {
  if (card.rank === 'skis') return '0';
  return card.name.toUpperCase();
}

/** Ime karte na sredini (Pagat, Mond, Škis ali rimska številka). */
function tarokCenterLabel(card: TarokCard): string {
  if (card.rank === 'skis') return 'Škis';
  if (card.rank === 1) return 'Pagat';
  if (card.rank === 21) return 'Mond';
  return card.name.toUpperCase();
}

function cardAccessibleName(card: Card): string {
  if (card.kind === 'tarok') return `Tarok ${tarokCenterLabel(card)}`;
  const suit = SUIT_DISPLAY[card.suit]?.name ?? card.suit;
  const rank = RANK_DISPLAY[card.rank] ?? card.rank;
  return `${suit} ${rank}`;
}

export const PlayingCard = React.memo(function PlayingCard({ card, onClick, disabled }: CardProps) {
  const interactive = !disabled && onClick !== undefined;
  const commonProps = {
    type: 'button' as const,
    disabled: !interactive,
    'aria-label': cardAccessibleName(card),
    onClick: interactive ? onClick : undefined,
  };
  const baseClass = `card disabled:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
    interactive ? 'cursor-pointer hover:-translate-y-2 transition-transform' : 'cursor-default'
  }`;

  if (card.kind === 'tarok') {
    const roman = tarokRankLabel(card);
    const isSpecial = card.rank === 'skis' || card.rank === 1 || card.rank === 21;

    return (
      <button
        {...commonProps}
        className={`${baseClass} card-tarok`}
        style={{
          background: 'linear-gradient(160deg, #fefce8 0%, #fef9c3 30%, #fde68a 70%, #fcd34d 100%)',
          border: '2.5px solid #92400e',
        }}
      >
        {/* Top-left corner */}
        <div className="card-corner" style={{ color: '#78350f' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 900 }}>{roman}</span>
          <span style={{ fontSize: '0.6rem' }}>★</span>
        </div>

        {/* Center design */}
        <div className="flex-grow flex flex-col items-center justify-center gap-0.5">
          <div
            className="card-tarok-symbol"
            style={{
              fontSize: isSpecial ? '2.2rem' : '1.6rem',
              color: isSpecial ? '#b91c1c' : '#78350f',
              textShadow: '0 1px 2px rgba(0,0,0,0.15)',
            }}
          >
            {card.rank === 'skis' ? '🃏' : card.rank === 1 ? '👑' : card.rank === 21 ? '🌙' : '✦'}
          </div>
          <div
            style={{
              fontSize: '0.55rem',
              color: '#92400e',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight: 1.1,
              maxWidth: '60px',
              marginTop: '2px',
            }}
          >
            {tarokCenterLabel(card)}
          </div>
        </div>

        {/* Bottom-right corner (inverted) */}
        <div className="card-corner self-end" style={{ color: '#78350f', transform: 'rotate(180deg)' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 900 }}>{roman}</span>
          <span style={{ fontSize: '0.6rem' }}>★</span>
        </div>

        {/* Decorative border pattern */}
        <div
          style={{
            position: 'absolute',
            inset: '4px',
            border: '1px solid rgba(146,64,14,0.25)',
            borderRadius: '3px',
            pointerEvents: 'none',
          }}
        />
      </button>
    );
  }

  // Suit card
  const suitInfo = SUIT_DISPLAY[card.suit];
  const rankStr = RANK_DISPLAY[card.rank] ?? String(card.rank);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <button
      {...commonProps}
      className={baseClass}
      style={{
        background: 'linear-gradient(160deg, #fffef5 0%, #fefce8 40%, #fef9c3 100%)',
        border: `2.5px solid ${isRed ? '#991b1b' : '#374151'}`,
      }}
    >
      {/* Top-left corner */}
      <div className="card-corner" style={{ color: suitInfo.color }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 900 }}>{rankStr}</span>
        <span className="card-corner-symbol">{suitInfo.symbol}</span>
      </div>

      {/* Center suit symbol */}
      <div className="flex-grow flex items-center justify-center">
        <span
          className="card-suit-symbol"
          style={{
            color: suitInfo.color,
            filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))',
          }}
        >
          {suitInfo.symbol}
        </span>
      </div>

      {/* Bottom-right corner (inverted) */}
      <div className="card-corner self-end" style={{ color: suitInfo.color, transform: 'rotate(180deg)' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 900 }}>{rankStr}</span>
        <span className="card-corner-symbol">{suitInfo.symbol}</span>
      </div>

      {/* Inner decorative border */}
      <div
        style={{
          position: 'absolute',
          inset: '4px',
          border: `1px solid ${isRed ? 'rgba(153,27,27,0.15)' : 'rgba(55,65,81,0.15)'}`,
          borderRadius: '3px',
          pointerEvents: 'none',
        }}
      />
    </button>
  );
});
