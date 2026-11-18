import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import { Box, Button, Chip, Link, Paper, Skeleton, Table, TableBody, TableCell, TableHead, TableRow, Typography, useMediaQuery } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../common';
import { ASSESSMENT_STATUS, SUBMISSION_STATUS } from './staffUtils';

/** Card with an optional heading row; the building block of staff pages. */
export function SectionCard({ title, subtitle, action, children, padding = 2.5, sx, contentSx, id }) {
  return (
    <Paper
      variant="outlined"
      component="section"
      aria-labelledby={title && id ? `${id}-title` : undefined}
      sx={{ borderRadius: 4, overflow: 'hidden', bgcolor: 'background.paper', ...sx }}
    >
      {(title || action) && (
        <Box
          sx={{
            px: padding,
            pt: 2,
            pb: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5,
            flexWrap: 'wrap',
          }}
        >
          <Box sx={{ minWidth: 0 }}>
            {title && (
              <Typography id={id ? `${id}-title` : undefined} variant="subtitle1" component="h2" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          {action && <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>{action}</Box>}
        </Box>
      )}
      <Box sx={{ px: padding, pb: padding, pt: title || action ? 0 : padding, ...contentSx }}>{children}</Box>
    </Paper>
  );
}

/** Recoverable error with a Retry button. */
/** Retrying only helps for network failures, timeouts, rate limits and server errors. */
const isRetryable = (error) => !error?.status || error.status >= 500 || error.status === 408 || error.status === 429;

/**
 * Error with a next step: Retry for transient failures, a way back for permission
 * problems (403) and other client errors where retrying cannot help.
 */
export function ErrorState({ error, onRetry, title = 'Something went wrong', compact = true, sx, backTo = '/app', backLabel = 'Back to dashboard' }) {
  if (error?.status === 403) {
    return (
      <EmptyState
        compact={compact}
        icon={<LockOutlinedIcon />}
        title="You don’t have access to this"
        description={`${error.message || 'Your role doesn’t allow this.'} Ask a workspace admin if you need access.`}
        action={
          <Button component={RouterLink} to={backTo} variant="contained">
            {backLabel}
          </Button>
        }
        sx={sx}
      />
    );
  }
  const retry = onRetry && isRetryable(error);
  return (
    <EmptyState
      tone="error"
      compact={compact}
      title={title}
      description={error?.message || 'Please try again.'}
      action={
        retry ? (
          <Button variant="outlined" color="inherit" startIcon={<RefreshRoundedIcon />} onClick={() => onRetry()}>
            Retry
          </Button>
        ) : onRetry ? (
          <Button component={RouterLink} to={backTo} variant="outlined" color="inherit">
            {backLabel}
          </Button>
        ) : null
      }
      sx={sx}
    />
  );
}

/** Soft, theme-aware chip used for statuses and tags. tone: palette key or 'default'. */
export function ToneChip({ label, tone = 'default', icon, size = 'small', sx, ...rest }) {
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
        height: size === 'small' ? 24 : 30,
        color: pal ? (theme.palette.mode === 'dark' ? pal.light : pal.dark) : 'text.secondary',
        bgcolor: pal ? alpha(pal.main, theme.palette.mode === 'dark' ? 0.2 : 0.1) : 'action.hover',
        border: '1px solid',
        borderColor: pal ? alpha(pal.main, 0.25) : 'divider',
        '& .MuiChip-icon': { color: 'inherit', fontSize: 16 },
        ...sx,
      }}
      {...rest}
    />
  );
}

export function AssessmentStatusChip({ status, ...rest }) {
  const meta = ASSESSMENT_STATUS[status] || { label: status || 'Unknown', tone: 'default' };
  return <ToneChip label={meta.label} tone={meta.tone} {...rest} />;
}

export function SubmissionStatusChip({ status, ...rest }) {
  const meta = SUBMISSION_STATUS[status] || { label: status || 'Unknown', tone: 'default' };
  return <ToneChip label={meta.label} tone={meta.tone} {...rest} />;
}

/** Placeholder rows shaped like the table that will load. */
export function TableSkeleton({ rows = 5, columns = 4, header = true }) {
  return (
    <Box sx={{ overflowX: 'auto' }} aria-busy="true" aria-label="Loading">
      <Table size="small">
        {header && (
          <TableHead>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableCell key={i}>
                  <Skeleton width={i === 0 ? 120 : 70} />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRow key={r}>
              {Array.from({ length: columns }).map((__, c) => (
                <TableCell key={c}>
                  <Skeleton width={c === 0 ? '70%' : '50%'} />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}

/** Coloured dot / bar used as a course accent. */
export function CourseSwatch({ color, size = 12, sx }) {
  return (
    <Box
      aria-hidden="true"
      sx={{ width: size, height: size, borderRadius: '30%', bgcolor: color || 'primary.main', flex: 'none', ...sx }}
    />
  );
}

/** Small label/value pair used in headers and summaries. */
export function MetaItem({ label, value, sx }) {
  return (
    <Box sx={{ minWidth: 0, ...sx }}>
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </Box>
  );
}

/** Horizontal score bar (0–100) with value label. */
export function ScoreBar({ value, tone = 'primary', width = 96 }) {
  const theme = useTheme();
  if (value === null || value === undefined) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        —
      </Typography>
    );
  }
  const pal = theme.palette[tone] || theme.palette.primary;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{ width, height: 6, borderRadius: 3, bgcolor: alpha(pal.main, 0.15), overflow: 'hidden', flex: 'none' }}
        role="presentation"
      >
        <Box sx={{ width: `${Math.max(0, Math.min(100, value))}%`, height: '100%', bgcolor: pal.main, borderRadius: 3 }} />
      </Box>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 44 }}>
        {Math.round(value)}%
      </Typography>
    </Box>
  );
}

/** True below the `sm` breakpoint, where wide tables switch to stacked cards. */
export function useIsMobile() {
  return useMediaQuery((t) => t.breakpoints.down('sm'));
}

/** Container for stacked mobile rows (replaces a wide table below `sm`). */
export function MobileList({ children, label, sx }) {
  return (
    <Box component="ul" aria-label={label} sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 1.25, ...sx }}>
      {children}
    </Box>
  );
}

/**
 * One table row rendered as a card: title (optionally a link), subtitle, chips,
 * a two-column meta grid and an optional trailing action (menu / icon button).
 */
export function MobileRow({ title, subtitle, to, onClick, leading, chips, meta = [], action, selected, sx }) {
  const titleNode = to ? (
    <Link component={RouterLink} to={to} underline="hover" sx={{ fontWeight: 700, color: 'text.primary', wordBreak: 'break-word' }}>
      {title}
    </Link>
  ) : onClick ? (
    <Link component="button" type="button" onClick={onClick} underline="hover" sx={{ fontWeight: 700, color: 'text.primary', textAlign: 'left', font: 'inherit' }}>
      {title}
    </Link>
  ) : (
    <Typography variant="body2" sx={{ fontWeight: 700, wordBreak: 'break-word' }}>
      {title}
    </Typography>
  );
  return (
    <Paper
      component="li"
      variant="outlined"
      sx={(t) => ({
        borderRadius: 3,
        p: 1.75,
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? alpha(t.palette.primary.main, 0.04) : 'background.paper',
        ...(typeof sx === 'function' ? sx(t) : sx),
      })}
    >
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
        {leading}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ fontSize: 14 }}>{titleNode}</Box>
          {subtitle && (
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.25, wordBreak: 'break-word' }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box sx={{ flex: 'none', mt: -0.5, mr: -0.75 }}>{action}</Box>}
      </Box>
      {chips && <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>{chips}</Box>}
      {meta.length > 0 && (
        <Box component="dl" sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, m: 0, mt: 1.25 }}>
          {meta.map((m) => (
            <Box key={m.label} sx={{ minWidth: 0 }}>
              <Typography component="dt" variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {m.label}
              </Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {m.value}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Paper>
  );
}
