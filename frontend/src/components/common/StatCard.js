import { Box, Paper, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import React from 'react';

/**
 * Compact metric tile.
 * tone: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'
 * trend: { value: '+12%', direction: 'up' | 'down', positive?: boolean }
 */
const StatCard = ({ label, value, icon, tone = 'primary', hint, trend, loading = false, onClick, sx }) => {
  const theme = useTheme();
  const palette = theme.palette[tone] || theme.palette.primary;
  const trendPositive = trend ? trend.positive ?? trend.direction === 'up' : false;
  const interactive = typeof onClick === 'function';

  return (
    <Paper
      variant="outlined"
      component={interactive ? 'button' : 'div'}
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      sx={{
        position: 'relative',
        width: '100%',
        p: 2.5,
        borderRadius: 4,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        textAlign: 'left',
        font: 'inherit',
        color: 'inherit',
        boxShadow: theme.shadows[1],
        overflow: 'hidden',
        ...(interactive && {
          cursor: 'pointer',
          transition: 'box-shadow .2s ease, transform .2s ease, border-color .2s ease',
          '&:hover': { boxShadow: theme.shadows[8], transform: 'translateY(-2px)', borderColor: 'divider' },
          '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
        }),
        ...sx,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.75 }} noWrap>
          {label}
        </Typography>
        {loading ? (
          <Skeleton variant="rounded" width="55%" height={34} />
        ) : (
          <Typography
            component="p"
            sx={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}
          >
            {value}
          </Typography>
        )}
        {(hint || trend) && !loading && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            {trend && (
              <Box
                component="span"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  color: trendPositive ? 'success.dark' : 'error.dark',
                  bgcolor: alpha(trendPositive ? theme.palette.success.main : theme.palette.error.main, 0.1),
                }}
              >
                {trend.direction === 'down' ? (
                  <ArrowDownwardRoundedIcon sx={{ fontSize: 14 }} />
                ) : (
                  <ArrowUpwardRoundedIcon sx={{ fontSize: 14 }} />
                )}
                {trend.value}
              </Box>
            )}
            {hint && (
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {hint}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      {icon && (
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            flex: 'none',
            color: tone === 'secondary' || tone === 'warning' ? palette.dark : palette.main,
            bgcolor: alpha(palette.main, tone === 'secondary' ? 0.18 : 0.1),
            boxShadow: `inset 0 0 0 1px ${alpha(palette.main, 0.16)}`,
            '& svg': { fontSize: 22 },
          }}
        >
          {icon}
        </Box>
      )}
    </Paper>
  );
};

export default StatCard;
