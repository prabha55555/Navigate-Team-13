import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import { Box, Button, Chip, LinearProgress, Paper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { EmptyState } from '../common';
import { timeLeft } from './format';

/** Soft tinted chip in a palette tone ('default' = neutral). */
export const ToneChip = ({ tone = 'default', label, icon, size = 'small', sx, ...rest }) => {
  const theme = useTheme();
  const pal = tone !== 'default' ? theme.palette[tone] : null;
  return (
    <Chip
      size={size}
      icon={icon}
      label={label}
      sx={{
        fontWeight: 600,
        borderRadius: 1.5,
        color: pal ? (theme.palette.mode === 'dark' ? pal.light : pal.dark) : 'text.secondary',
        bgcolor: pal ? alpha(pal.main, theme.palette.mode === 'dark' ? 0.18 : 0.1) : 'action.hover',
        '& .MuiChip-icon': { color: 'inherit', fontSize: 16 },
        ...sx,
      }}
      {...rest}
    />
  );
};

/** "3 days left" / "Past due" chip computed from a due date. */
export const TimeLeftChip = ({ dueDate, now, sx }) => {
  const info = timeLeft(dueDate, now);
  if (!info) return <ToneChip label="No due date" icon={<ScheduleRoundedIcon />} sx={sx} />;
  return <ToneChip tone={info.tone} label={info.label} icon={<ScheduleRoundedIcon />} sx={sx} />;
};

/** Outlined section with an optional heading row. */
export const Section = ({ title, action, children, sx, contentSx, component = 'section', ...rest }) => (
  <Paper variant="outlined" component={component} sx={{ borderRadius: 4, overflow: 'hidden', ...sx }} {...rest}>
    {(title || action) && (
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          pt: 2,
          pb: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          flexWrap: 'wrap',
        }}
      >
        {typeof title === 'string' ? (
          <Typography variant="h6" component="h2" sx={{ fontSize: '1.05rem' }}>
            {title}
          </Typography>
        ) : (
          title
        )}
        {action}
      </Box>
    )}
    <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: 2.5, pt: title || action ? 0 : 2.5, ...contentSx }}>{children}</Box>
  </Paper>
);

/** Error state with a retry button. */
export const ErrorState = ({ error, onRetry, title = "We couldn't load this", compact, action }) => (
  <EmptyState
    tone="error"
    compact={compact}
    title={title}
    description={error?.message || String(error || 'Something went wrong.')}
    action={
      action || (onRetry ? (
        <Button variant="contained" onClick={onRetry}>
          Retry
        </Button>
      ) : null)
    }
  />
);

/** A coloured dot in a course's own colour (server data, falls back to primary). */
export const CourseDot = ({ color, size = 10, sx }) => (
  <Box
    component="span"
    aria-hidden="true"
    sx={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', flex: 'none', bgcolor: color || 'primary.main', ...sx }}
  />
);

export const TOPIC_STATUS = {
  mastered: { label: 'Mastered', tone: 'success' },
  developing: { label: 'Developing', tone: 'warning' },
  'needs-work': { label: 'Needs work', tone: 'error' },
  'not-assessed': { label: 'Not assessed', tone: 'default' },
};

export const topicStatusFor = (mastery) => {
  if (mastery == null) return 'not-assessed';
  if (mastery >= 80) return 'mastered';
  if (mastery >= 50) return 'developing';
  return 'needs-work';
};

/** Thin progress bar in a tone. */
export const ToneBar = ({ value, tone = 'primary', height = 8, label }) => {
  const theme = useTheme();
  const pal = theme.palette[tone] || theme.palette.primary;
  return (
    <LinearProgress
      variant="determinate"
      color={theme.palette[tone] ? tone : 'primary'}
      value={Math.max(0, Math.min(100, Number(value) || 0))}
      aria-label={label}
      sx={{
        height,
        borderRadius: height,
        bgcolor: alpha(pal.main, 0.14),
        '& .MuiLinearProgress-bar': { borderRadius: height, bgcolor: pal.main, ...(tone !== 'primary' && { backgroundImage: 'none' }) },
      }}
    />
  );
};

/** alpha() that tolerates bad colour strings from the server (falls back to `fallback`). */
export const safeAlpha = (color, opacity, fallback) => {
  try {
    return alpha(color, opacity);
  } catch {
    return alpha(fallback, opacity);
  }
};
