import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import { Box, Slide, Typography } from '@mui/material';
import React, { useEffect, useState } from 'react';

/** True while the browser reports a network connection. */
export const useOnline = () => {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
};

/** Thin banner pinned to the top of the viewport while offline. */
const OfflineBanner = () => {
  const online = useOnline();
  return (
    <Slide direction="down" in={!online} mountOnEnter unmountOnExit>
      <Box
        role="status"
        aria-live="assertive"
        sx={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: (t) => t.zIndex.snackbar + 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1,
          px: 2,
          py: 0.75,
          bgcolor: 'warning.main',
          color: 'warning.contrastText',
        }}
      >
        <CloudOffRoundedIcon fontSize="small" />
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          You're offline. Changes will fail to save until your connection is back.
        </Typography>
      </Box>
    </Slide>
  );
};

export default OfflineBanner;
