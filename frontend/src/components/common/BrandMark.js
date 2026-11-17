import { Box } from '@mui/material';
import React, { useId } from 'react';

const TILE = {
  ink: ['#18234A', '#0E1630'],
  blue: ['#6B7BFF', '#2232B8'],
};

/**
 * Navigate's compass / north-star mark. The north needle is saffron — the destination.
 *
 * tone: 'ink' (for light surfaces) | 'blue' (for ink surfaces)
 * withWordmark: render the "Navigate" wordmark next to the glyph
 * title: accessible name; omit when the mark is decorative or labelled by its parent
 */
const BrandMark = ({
  size = 32,
  tone = 'ink',
  withWordmark = false,
  wordmarkColor = 'inherit',
  wordmarkSize,
  title,
  sx,
}) => {
  const gradientId = `nv-mark-${useId().replace(/:/g, '')}`;
  const [from, to] = TILE[tone] || TILE.ink;

  const glyph = (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      style={{ display: 'block', flex: 'none' }}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={from} />
          <stop offset="1" stopColor={to} />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill={`url(#${gradientId})`} />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="rgba(255,255,255,0.14)" />
      <circle cx="20" cy="20" r="11.5" fill="none" stroke="rgba(255,255,255,0.26)" strokeWidth="1.3" />
      {/* East, south and west arms */}
      <path d="M22 18 L31.5 20 L22 22 L20 32 L18 22 L8.5 20 L18 18 L20 20 Z" fill="#FFFFFF" />
      {/* North needle */}
      <path d="M20 4.5 L22 18 L20 20 L18 18 Z" fill="#F2A93B" />
      <circle cx="20" cy="20" r="1.4" fill={to} />
    </svg>
  );

  if (!withWordmark) {
    return sx ? <Box sx={{ display: 'inline-flex', ...sx }}>{glyph}</Box> : glyph;
  }

  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: `${Math.round(size * 0.34)}px`, color: wordmarkColor, ...sx }}
    >
      {glyph}
      <Box
        component="span"
        sx={{
          fontFamily: 'var(--nv-font-display)',
          fontWeight: 600,
          fontSize: wordmarkSize || `${Math.round(size * 0.66)}px`,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        Navigate
      </Box>
    </Box>
  );
};

export default BrandMark;
