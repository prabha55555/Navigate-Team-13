import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import {
  Alert,
  Box,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React from 'react';
import { EmptyState } from '../../common';
import { ErrorState, ToneChip } from '../StaffUI';
import { questionTypeLabel } from '../staffUtils';

const FLAGS = {
  'too-easy': {
    label: 'Too easy',
    tone: 'info',
    explain: 'More than 90% of the available points were earned. It may not tell you much about who understands the topic — consider making it harder or replacing it.',
  },
  'too-hard': {
    label: 'Too hard',
    tone: 'warning',
    explain: 'Fewer than 30% of the available points were earned. Check the wording and the answer key, or whether the topic was taught before the test.',
  },
  'poor-discrimination': {
    label: 'Doesn’t separate',
    tone: 'error',
    explain: 'Strong and weak students did about equally well (or weak students did better). The question may be ambiguous, have a wrong key, or test something unrelated.',
  },
};

const HELP = {
  difficulty:
    'Difficulty index (p-value): the average share of this question’s points that students earned. 1.0 = everyone got full marks, 0 = nobody scored. Ideal range is roughly 0.3–0.9.',
  discrimination:
    'Discrimination index: how much better the top 27% of students (by total score) did on this question than the bottom 27%. Above 0.3 is good, 0.2–0.3 acceptable, below 0.2 means the question doesn’t separate strong from weak students.',
};

function HeaderWithHelp({ label, help, align }) {
  return (
    <TableCell align={align}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
        {label}
        <Tooltip title={help} enterTouchDelay={0}>
          <HelpOutlineRoundedIcon sx={{ fontSize: 16, color: 'text.secondary', cursor: 'help' }} tabIndex={0} aria-label={help} />
        </Tooltip>
      </Box>
    </TableCell>
  );
}

/** Quality bands: difficulty is healthy in 0.3–0.9; discrimination is good from 0.3, acceptable 0.2–0.3. */
const difficultyQuality = (v, flag) => {
  if (flag === 'too-easy' || flag === 'too-hard') return 'poor';
  if (v >= 0.3 && v <= 0.9) return 'good';
  return v >= 0.2 && v <= 0.95 ? 'ok' : 'poor';
};
const discriminationQuality = (v, flag) => {
  if (flag === 'poor-discrimination' || v < 0.2) return 'poor';
  return v >= 0.3 ? 'good' : 'ok';
};
const QUALITY = { good: { tone: 'success', label: 'good' }, ok: { tone: 'warning', label: 'acceptable' }, poor: { tone: 'error', label: 'poor' } };

function IndexBar({ value, min = 0, max = 1, quality }) {
  const theme = useTheme();
  if (value === null || value === undefined) return <Typography variant="body2" sx={{ color: 'text.secondary' }}>—</Typography>;
  const pct = ((value - min) / (max - min)) * 100;
  const q = QUALITY[quality] || QUALITY.good;
  const color = theme.palette[q.tone].main;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
      <Box sx={{ width: 60, height: 6, borderRadius: 3, bgcolor: alpha(color, 0.18), overflow: 'hidden' }} aria-hidden="true">
        <Box sx={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: '100%', bgcolor: color }} />
      </Box>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>
        {value.toFixed(2)}
        <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
          {' '}
          ({q.label})
        </Box>
      </Typography>
    </Box>
  );
}

export default function AssessmentAnalyticsTab({ analytics }) {
  const { data, error, loading, reload } = analytics;
  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t load item analysis" />;
  if (loading) return <Skeleton variant="rounded" height={320} />;

  const items = data?.items || [];
  const enough = items.some((i) => i.difficultyIndex !== null && i.difficultyIndex !== undefined);
  const flagged = items.filter((i) => i.flag);

  if (!items.length) {
    return <EmptyState icon={<QueryStatsRoundedIcon />} title="No questions to analyse" description="Add questions and collect submissions to see item analysis." />;
  }

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      {!enough ? (
        <Alert severity="info">
          Item analysis needs at least 5 submissions to be meaningful. {data?.summary?.submissions ? `There ${data.summary.submissions === 1 ? 'is' : 'are'} ${data.summary.submissions} so far.` : ''}
        </Alert>
      ) : flagged.length ? (
        <Alert severity="warning">
          {flagged.length} question{flagged.length === 1 ? '' : 's'} may need attention. Hover a flag to see why.
        </Alert>
      ) : (
        <Alert severity="success">Every question is performing within the normal range.</Alert>
      )}
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
        <Table sx={{ minWidth: 820 }} aria-label="Item analysis">
          <TableHead>
            <TableRow>
              <TableCell width={40}>#</TableCell>
              <TableCell>Question</TableCell>
              <TableCell>Topic</TableCell>
              <TableCell align="right">Avg points</TableCell>
              <HeaderWithHelp label="Difficulty" help={HELP.difficulty} align="right" />
              <HeaderWithHelp label="Discrimination" help={HELP.discrimination} align="right" />
              <TableCell>Flag</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((it, i) => {
              const flag = FLAGS[it.flag];
              return (
                <TableRow key={it.questionId} hover>
                  <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>{i + 1}</TableCell>
                  <TableCell sx={{ maxWidth: 360 }}>
                    <Typography variant="body2" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={it.text}>
                      {it.text}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {questionTypeLabel(it.type)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: it.topic ? 'text.primary' : 'text.secondary' }}>
                      {it.topic || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {it.averagePoints === null || it.averagePoints === undefined ? '—' : `${it.averagePoints} / ${it.points}`}
                  </TableCell>
                  <TableCell align="right">
                    <IndexBar value={it.difficultyIndex} quality={difficultyQuality(it.difficultyIndex, it.flag)} />
                  </TableCell>
                  <TableCell align="right">
                    <IndexBar value={it.discriminationIndex} min={-1} max={1} quality={discriminationQuality(it.discriminationIndex, it.flag)} />
                  </TableCell>
                  <TableCell>
                    {flag ? (
                      <Tooltip title={flag.explain} enterTouchDelay={0}>
                        <span tabIndex={0} aria-label={`${flag.label}: ${flag.explain}`}>
                          <ToneChip label={flag.label} tone={flag.tone} />
                        </span>
                      </Tooltip>
                    ) : enough ? (
                      <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 600 }}>
                        OK
                      </Typography>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        Based on each student’s best graded attempt. Bar colours: green = good, amber = acceptable, red = needs attention. Difficulty is healthy between 0.3 and 0.9; discrimination is good from 0.3 and acceptable from 0.2.
      </Typography>
    </Box>
  );
}
