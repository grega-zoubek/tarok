import React from 'react';
import { type Card } from '@tarok/engine';

interface CardProps {
  card: Card;
  onClick?: () => void;
  disabled?: boolean;
}

// Map French suits to traditional Tarok suits for display
const SUIT_DISPLAY: Record<string, { symbol: string; name: string; color: string }> = {
  hearts:   { symbol: '♥', name: 'Srca',  color: '#dc2626' },
  diamonds: { symbol: '♦', name: 'Karo', color: '#dc2626' },
  clubs:    { symbol: '♣', name: 'Križ',  color: '#1f2937' },
  spades:   { symbol: '♠', name: 'Pik',  color: '#1f2937' },
};

// Traditional Tarok card names (Slovenian)
const TAROK_NAMES: Record<number | string, string> = {
  1: 'Pagat', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV',
  16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX',
  21: 'Mond',
  skis: 'Škis',
};

// Roman numeral display for tarok cards
const ROMAN: Record<number | string, string> = {
  1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V',
  6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
  11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV',
  16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX',
  21: 'XXI',
  skis: '0',
};

const RANK_DISPLAY: Record<string, string> = {
  king: 'K', queen: 'Q', cavalier: 'C', jack: 'J', ace: 'A',
};

export function PlayingCard({ card, onClick, disabled }: CardProps) {
  const isTarok = card.kind === 'tarok';

  if (isTarok) {
    const rank = card.rank;
    const roman = ROMAN[rank] ?? String(rank);
    const isSpecial = rank === 'skis' || rank === 1 || rank === 21;

    return (
      <div
        className={`card card-tarok ${disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-2 transition-transform'}`}
        onClick={!disabled ? onClick : undefined}
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
            {rank === 'skis' ? '🃏' : rank === 1 ? '👑' : rank === 21 ? '🌙' : '✦'}
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
            {TAROK_NAMES[rank] ?? ''}
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
      </div>
    );
  }

  // Suit card
  const suitInfo = SUIT_DISPLAY[card.suit] ?? SUIT_DISPLAY.hearts!;
  const rankStr = RANK_DISPLAY[card.rank] ?? String(card.rank);
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  return (
    <div
      className={`card ${disabled ? 'cursor-default' : 'cursor-pointer hover:-translate-y-2 transition-transform'}`}
      onClick={!disabled ? onClick : undefined}
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
    </div>
  );
}