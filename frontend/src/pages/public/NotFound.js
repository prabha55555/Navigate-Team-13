import ExploreOffOutlinedIcon from '@mui/icons-material/ExploreOffOutlined';
import { Box, Button, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import BrandMark from '../../components/common/BrandMark';
import { useAuth } from '../../contexts/AuthContext';

/** 404. `inShell` renders inside the app layout (no brand header). */
const NotFound = ({ inShell = false }) => {
  const { currentUser } = useAuth();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!inShell) document.title = 'Page not found · Navigate';
  }, [inShell]);

  const content = (
    <Box sx={{ maxWidth: 480, mx: 'auto', textAlign: 'center', py: { xs: 6, md: 10 }, px: 2 }}>
      <Box
        aria-hidden="true"
        sx={(t) => ({
          width: 72,
          height: 72,
          mx: 'auto',
          mb: 3,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: alpha(t.palette.primary.main, 0.1),
          '& svg': { fontSize: 34 },
        })}
      >
        <ExploreOffOutlinedIcon />
      </Box>
      <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
        Error 404
      </Typography>
      <Typography variant="h3" component="h1" sx={{ mb: 1.5 }}>
        This page is off the map
      </Typography>
      <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, wordBreak: 'break-word' }}>
        We couldn’t find <Box component="code" sx={{ fontWeight: 600, color: 'text.primary' }}>{pathname}</Box>. It may have moved, or the link
        might be incomplete.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center">
        <Button component={RouterLink} to={currentUser ? '/app' : '/'} variant="contained">
          {currentUser ? 'Go to dashboard' : 'Go to home page'}
        </Button>
        {!currentUser && (
          <Button component={RouterLink} to="/login" variant="outlined">
            Sign in
          </Button>
        )}
      </Stack>
    </Box>
  );

  if (inShell) return content;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column' }}>
      <Box component="header" sx={{ px: { xs: 2, sm: 5 }, py: 3 }}>
        <Box component={RouterLink} to="/" aria-label="Navigate home" sx={{ color: 'text.primary', display: 'inline-flex' }}>
          <BrandMark size={32} withWordmark wordmarkSize="1.35rem" />
        </Box>
      </Box>
      <Box component="main" sx={{ flex: 1, display: 'grid', placeItems: 'center' }}>
        {content}
      </Box>
    </Box>
  );
};

export default NotFound;
