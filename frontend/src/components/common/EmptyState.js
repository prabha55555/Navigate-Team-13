import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import ReportGmailerrorredRoundedIcon from '@mui/icons-material/ReportGmailerrorredRounded';
import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';

/**
 * Friendly placeholder for empty lists and recoverable errors.
 * tone: 'neutral' (default) | 'error'
 */
const EmptyState = ({ icon, title, description, action, tone = 'neutral', compact = false, sx }) => {
  const theme = useTheme();
  const isError = tone === 'error';
  const accent = isError ? theme.palette.error.main : theme.palette.primary.main;
  const glyph = icon || (isError ? <ReportGmailerrorredRoundedIcon /> : <ExploreOutlinedIcon />);

  return (
    <Box
      role={isError ? 'alert' : 'status'}
      sx={{
        textAlign: 'center',
        px: { xs: 2.5, sm: 4 },
        py: compact ? 4 : { xs: 5, sm: 7 },
        borderRadius: 4,
        border: '1px dashed',
        borderColor: isError ? alpha(accent, 0.4) : 'grey.300',
        bgcolor: isError ? alpha(accent, 0.03) : 'rgba(255,255,255,0.6)',
        ...sx,
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          position: 'relative',
          width: compact ? 48 : 60,
          height: compact ? 48 : 60,
          mx: 'auto',
          mb: 2,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: isError ? 'error.dark' : 'primary.main',
          bgcolor: alpha(accent, 0.08),
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: -7,
            borderRadius: '50%',
            border: `1px dashed ${alpha(accent, 0.3)}`,
          },
          '& svg': { fontSize: compact ? 24 : 28 },
        }}
      >
        {glyph}
      </Box>
      {title && (
        <Typography variant="h6" component="p" sx={{ mb: 0.75 }}>
          {title}
        </Typography>
      )}
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 420, mx: 'auto' }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>{action}</Box>}
    </Box>
  );
};

export default EmptyState;
