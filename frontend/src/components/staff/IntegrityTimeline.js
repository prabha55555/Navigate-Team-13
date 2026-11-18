import ContentPasteRoundedIcon from '@mui/icons-material/ContentPasteRounded';
import FullscreenExitRoundedIcon from '@mui/icons-material/FullscreenExitRounded';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import StopRoundedIcon from '@mui/icons-material/StopRounded';
import TabRoundedIcon from '@mui/icons-material/TabRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Alert, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import React from 'react';
import { formatTime, integrityLabel } from './staffUtils';

const ICONS = {
  fullscreen_exit: <FullscreenExitRoundedIcon />,
  blocked_shortcut: <KeyboardRoundedIcon />,
  tab_hidden: <TabRoundedIcon />,
  paste: <ContentPasteRoundedIcon />,
  camera_lost: <VideocamOffRoundedIcon />,
};

const offset = (at, start) => {
  if (!at || !start) return '';
  const s = Math.max(0, Math.round((new Date(at) - new Date(start)) / 1000));
  return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Vertical timeline of integrity events, framed by the attempt's start and end, plus the plagiarism result. */
export default function IntegrityTimeline({ integrity, plagiarism, startedAt, submittedAt }) {
  const events = [...(integrity?.events || [])].sort((a, b) => new Date(a.at) - new Date(b.at));
  const rows = [
    startedAt && { kind: 'start', at: startedAt, label: 'Attempt started', icon: <PlayArrowRoundedIcon />, tone: 'info' },
    ...events.map((e) => ({ kind: 'event', at: e.at, label: integrityLabel(e.type), detail: e.detail, icon: ICONS[e.type] || <WarningAmberRoundedIcon />, tone: 'warning' })),
    submittedAt && {
      kind: 'end',
      at: submittedAt,
      label: integrity?.terminated ? 'Attempt ended automatically (too many violations)' : 'Submitted',
      icon: <StopRoundedIcon />,
      tone: integrity?.terminated ? 'error' : 'success',
    },
  ].filter(Boolean);

  const sim = plagiarism && plagiarism.status !== 'timeout' ? plagiarism : null;

  return (
    <Box>
      {!events.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          No integrity events were recorded.
        </Typography>
      )}
      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0 }} aria-label="Attempt timeline">
        {rows.map((r, i) => (
          <Box component="li" key={`${r.kind}-${i}`} sx={{ display: 'flex', gap: 1.5, position: 'relative', pb: i === rows.length - 1 ? 0 : 1.75 }}>
            {i < rows.length - 1 && (
              <Box aria-hidden="true" sx={{ position: 'absolute', left: 13, top: 28, bottom: 0, width: 2, bgcolor: 'divider' }} />
            )}
            <Box
              aria-hidden="true"
              sx={(t) => ({
                width: 28,
                height: 28,
                borderRadius: '50%',
                flex: 'none',
                display: 'grid',
                placeItems: 'center',
                color: t.palette.mode === 'dark' ? t.palette[r.tone].light : t.palette[r.tone].dark,
                bgcolor: alpha(t.palette[r.tone].main, 0.14),
                '& svg': { fontSize: 16 },
              })}
            >
              {r.icon}
            </Box>
            <Box sx={{ minWidth: 0, pt: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {r.label}
                {r.detail && (
                  <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>
                    {' '}
                    — {r.detail}
                  </Typography>
                )}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(r.at)} {r.kind !== 'start' ? offset(r.at, startedAt) : ''}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>
      {sim && (
        <Alert severity={sim.isPlagiarismDetected ? 'error' : 'success'} sx={{ mt: 2 }}>
          {sim.isPlagiarismDetected
            ? `Written answers are similar to another submission (similarity ${Math.round((sim.overallSimilarityScore || 0) * (sim.overallSimilarityScore > 1 ? 1 : 100))}%).`
            : 'Similarity check passed for written answers.'}
          {sim.aiGeneratedContentDetected ? ' Some text may be AI-generated.' : ''}
        </Alert>
      )}
      {plagiarism?.status === 'timeout' && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The similarity check didn’t finish in time for this submission.
        </Alert>
      )}
    </Box>
  );
}
