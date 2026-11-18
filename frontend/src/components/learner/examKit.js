import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { memo, useEffect, useRef, useState } from 'react';
import { formatClock } from './format';

// ---------------------------------------------------------------------------
// Fullscreen API helpers (prefixed variants for Safari / older browsers),
// ported from the legacy AssessmentTake page.
// ---------------------------------------------------------------------------
export const FULLSCREEN_EVENTS = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'];

export const getFullscreenElement = () =>
  document.fullscreenElement ||
  document.webkitFullscreenElement ||
  document.mozFullScreenElement ||
  document.msFullscreenElement ||
  null;

export const fullscreenSupported = () => {
  const el = typeof document !== 'undefined' ? document.documentElement : null;
  return Boolean(el && (el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen));
};

/**
 * Enter full screen. Must be called from a user gesture (click/keypress).
 * The whole document goes full screen so dialogs, menus and toasts (portalled to <body>) stay visible.
 */
export const enterFullscreen = (elem = document.documentElement) => {
  if (!elem) return Promise.reject(new Error('Nothing to show in full screen'));
  if (getFullscreenElement()) return Promise.resolve();
  const request = elem.requestFullscreen || elem.webkitRequestFullscreen || elem.mozRequestFullScreen || elem.msRequestFullscreen;
  if (!request) return Promise.reject(new Error('Full screen is not supported'));
  try {
    return Promise.resolve(request.call(elem, { navigationUI: 'hide' }));
  } catch (e) {
    return Promise.reject(e);
  }
};

export const exitFullscreen = () => {
  if (!getFullscreenElement()) return;
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return;
  try {
    Promise.resolve(exit.call(document)).catch(() => {});
  } catch (e) {
    // Ignore errors if the document already left full screen
  }
};

// Ctrl/Cmd + C, V, X, R are blocked when the assessment blocks shortcuts. `code` covers non-Latin layouts.
export const BLOCKED_COMBO_KEYS = new Set(['c', 'v', 'x', 'r']);
export const BLOCKED_COMBO_CODES = new Set(['KeyC', 'KeyV', 'KeyX', 'KeyR']);

/** True when the keyboard focus is in a text input (so shortcuts must not hijack typing). */
export const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'TEXTAREA') return true;
  if (tag === 'INPUT') {
    const type = (target.getAttribute('type') || 'text').toLowerCase();
    return !['radio', 'checkbox', 'button', 'submit'].includes(type);
  }
  return Boolean(target.isContentEditable);
};

// ---------------------------------------------------------------------------
// Countdown chip — owns its own tick so the exam does not re-render every second.
// Time is derived from a fixed end timestamp (server deadline adjusted for clock skew),
// so throttled background timers and wrong device clocks can't drift it.
// ---------------------------------------------------------------------------
const secondsUntil = (endTime) => Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
const WARNINGS = [300, 60];

function CountdownChip({ endTime, onExpire, onWarning }) {
  const theme = useTheme();
  const [remaining, setRemaining] = useState(() => secondsUntil(endTime));
  const onExpireRef = useRef(onExpire);
  const onWarningRef = useRef(onWarning);

  useEffect(() => {
    onExpireRef.current = onExpire;
    onWarningRef.current = onWarning;
  }, [onExpire, onWarning]);

  useEffect(() => {
    let expired = false;
    let previous = Infinity;
    const tick = () => {
      const left = secondsUntil(endTime);
      setRemaining(left);
      // Fire the smallest threshold crossed since the last tick (one warning per crossing).
      const crossed = WARNINGS.filter((t) => previous > t && left <= t && left > 0);
      if (crossed.length && onWarningRef.current) onWarningRef.current(Math.min(...crossed));
      previous = left;
      if (left <= 0 && !expired) {
        expired = true;
        clearInterval(intervalId);
        if (onExpireRef.current) onExpireRef.current();
      }
    };
    const intervalId = setInterval(tick, 500);
    tick();
    return () => clearInterval(intervalId);
  }, [endTime]);

  const tone = remaining <= 60 ? 'error' : remaining <= 300 ? 'warning' : null;
  const pal = tone ? theme.palette[tone] : null;
  const mins = Math.floor(remaining / 60);

  return (
    <Box
      role="timer"
      aria-label={`Time remaining: ${mins} minute${mins === 1 ? '' : 's'} ${remaining % 60} seconds`}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        height: 36,
        borderRadius: 2,
        fontWeight: 700,
        fontSize: '0.95rem',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.01em',
        color: pal ? (theme.palette.mode === 'dark' ? pal.light : pal.dark) : 'text.primary',
        bgcolor: pal ? alpha(pal.main, 0.14) : 'action.hover',
        border: '1px solid',
        borderColor: pal ? alpha(pal.main, 0.4) : 'divider',
        transition: 'background-color .3s ease, color .3s ease',
        ...(remaining <= 60 && remaining > 0 && {
          '@media (prefers-reduced-motion: no-preference)': {
            animation: 'navigate-pulse 1s ease-in-out infinite',
            '@keyframes navigate-pulse': { '50%': { bgcolor: alpha(theme.palette.error.main, 0.26) } },
          },
        }),
      }}
    >
      <TimerOutlinedIcon sx={{ fontSize: 18 }} aria-hidden="true" />
      {formatClock(remaining)}
    </Box>
  );
}

export const ExamCountdown = memo(CountdownChip);
