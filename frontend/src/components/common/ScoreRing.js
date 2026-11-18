import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

/**
 * Circular score indicator. `value` is 0–100.
 * tone: any palette key ('primary', 'success', 'warning', 'error', 'info', 'secondary')
 */
const ScoreRing = ({ value = 0, size = 72, thickness = 7, tone = 'primary', track, label, sublabel, sx }) => {
  const theme = useTheme();
  const clamped = Math.max(0, Math.min(100, Number(value) || 0));
  const radius = 50 - thickness / 2;
  const color = theme.palette[tone]?.main || tone;

  return (
    <Box
      role="img"
      aria-label={`${Math.round(clamped)} percent${sublabel ? `, ${sublabel}` : ''}`}
      sx={{ position: 'relative', width: size, height: size, flex: 'none', ...sx }}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="50" cy="50" r={radius} fill="none" stroke={track || alpha(theme.palette.text.primary, 0.08)} strokeWidth={thickness} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray={`${clamped} 100`}
        />
      </svg>
      <Box
        aria-hidden="true"
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
          fontSize: Math.round(size * 0.26),
          letterSpacing: '-0.03em',
          color: 'text.primary',
          lineHeight: 1,
        }}
      >
        {label ?? `${Math.round(clamped)}%`}
      </Box>
    </Box>
  );
};

export default ScoreRing;
