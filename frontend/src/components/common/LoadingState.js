import { Box, CircularProgress, Typography } from '@mui/material';
import React from 'react';
import BrandMark from './BrandMark';

/**
 * Centered loading indicator. `fullScreen` shows the brand mark for app-level waits.
 */
const LoadingState = ({ label, fullScreen = false, minHeight, sx }) => (
  <Box
    role="status"
    aria-live="polite"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      minHeight: minHeight || (fullScreen ? '100vh' : '50vh'),
      ...sx,
    }}
  >
    {fullScreen ? (
      <Box sx={{ position: 'relative', width: 56, height: 56, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={56} thickness={2.4} sx={{ position: 'absolute', inset: 0, color: 'primary.light' }} />
        <BrandMark size={36} />
      </Box>
    ) : (
      <CircularProgress size={32} />
    )}
    <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 500 }}>
      {label || 'Loading…'}
    </Typography>
  </Box>
);

export default LoadingState;
