import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import {
  Box,
  Link,
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
import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { EmptyState } from '../../common';
import { AssessmentStatusChip, ErrorState, SectionCard } from '../StaffUI';
import { blend, readableOn } from '../charts';
import { formatPercent } from '../staffUtils';

// Sequential scale: one hue (primary), light → dark, five steps.
const STEPS = [
  { min: 0, max: 20, label: '0–19%' },
  { min: 20, max: 40, label: '20–39%' },
  { min: 40, max: 60, label: '40–59%' },
  { min: 60, max: 80, label: '60–79%' },
  { min: 80, max: 101, label: '80–100%' },
];
const ALPHAS = [0.1, 0.26, 0.45, 0.68, 0.92];
const stepFor = (v) => STEPS.findIndex((s) => v >= s.min && v < s.max);

function useHeatColors() {
  const theme = useTheme();
  return useMemo(() => {
    const base = theme.palette.primary.main;
    const paper = theme.palette.background.paper;
    // Text colour is chosen per step by actual contrast against the blended cell colour.
    return ALPHAS.map((a) => {
      const bg = blend(base, paper, a);
      return { bg, fg: readableOn(bg, [theme.palette.text.primary, theme.palette.common.white, theme.palette.common.black]) };
    });
  }, [theme]);
}

function Heatmap({ topics, students }) {
  const theme = useTheme();
  const colors = useHeatColors();
  const topicAverages = useMemo(
    () =>
      topics.map((t) => {
        const vals = students.map((s) => s.mastery?.[t]).filter((v) => typeof v === 'number');
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }),
    [topics, students]
  );
  const rows = useMemo(
    () =>
      students.map((s) => {
        const vals = topics.map((t) => s.mastery?.[t]).filter((v) => typeof v === 'number');
        return { ...s, average: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null };
      }),
    [students, topics]
  );

  const cell = (value, label) => {
    if (typeof value !== 'number') {
      return (
        <Tooltip title={`${label}: not assessed yet`}>
          <Box
            tabIndex={0}
            aria-label={`${label}: not assessed`}
            sx={{
              height: 34,
              borderRadius: 1,
              display: 'grid',
              placeItems: 'center',
              color: 'text.disabled',
              fontSize: 12,
              backgroundImage: `repeating-linear-gradient(45deg, ${alpha(theme.palette.text.primary, 0.06)} 0 4px, transparent 4px 8px)`,
              '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
            }}
          >
            –
          </Box>
        </Tooltip>
      );
    }
    const c = colors[stepFor(value)] || colors[0];
    return (
      <Tooltip title={`${label}: ${formatPercent(value, '—', value % 1 ? 1 : 0)} mastery`}>
        <Box
          tabIndex={0}
          aria-label={`${label}: ${Math.round(value)} percent`}
          sx={{
            height: 34,
            borderRadius: 1,
            display: 'grid',
            placeItems: 'center',
            bgcolor: c.bg,
            color: c.fg,
            fontSize: 12,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            '&:hover': { boxShadow: `0 0 0 2px ${theme.palette.background.paper}, 0 0 0 3px ${theme.palette.text.primary}` },
            '&:focus-visible': { outline: `2px solid ${theme.palette.text.primary}`, outlineOffset: 1 },
          }}
        >
          {Math.round(value)}
        </Box>
      </Tooltip>
    );
  };

  const stickyCol = { position: 'sticky', left: 0, zIndex: 1, bgcolor: 'background.paper' };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 2 }} aria-label="Colour legend">
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          Mastery
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {STEPS.map((s, i) => (
            <Box key={s.label} sx={{ textAlign: 'center' }}>
              <Box sx={{ width: 44, height: 12, borderRadius: 0.75, bgcolor: colors[i].bg }} />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 10 }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box
            sx={{
              width: 22,
              height: 12,
              borderRadius: 0.75,
              backgroundImage: `repeating-linear-gradient(45deg, ${alpha(theme.palette.text.primary, 0.12)} 0 4px, transparent 4px 8px)`,
            }}
          />
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Not assessed
          </Typography>
        </Box>
      </Box>
      <Box sx={{ overflow: 'auto', maxHeight: '70vh' }}>
        <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: '4px', width: '100%', minWidth: 160 + topics.length * 84 }}>
          <caption style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
            Topic mastery by student, in percent
          </caption>
          <thead>
            <tr>
              <Box component="th" scope="col" sx={{ ...stickyCol, top: 0, zIndex: 3, position: 'sticky', textAlign: 'left', minWidth: { xs: 120, sm: 170 } }}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Student
                </Typography>
              </Box>
              {topics.map((t) => (
                <Box
                  component="th"
                  scope="col"
                  key={t}
                  sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 80, maxWidth: 110, verticalAlign: 'bottom', textAlign: 'center' }}
                >
                  <Typography variant="caption" component="div" sx={{ fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>
                    {t}
                  </Typography>
                </Box>
              ))}
              <Box
                component="th"
                scope="col"
                sx={{ position: 'sticky', top: 0, zIndex: 2, bgcolor: 'background.paper', minWidth: 64, verticalAlign: 'bottom', textAlign: 'center' }}
              >
                <Typography variant="caption" sx={{ fontWeight: 700 }}>
                  Avg
                </Typography>
              </Box>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Box component="th" scope="row" sx={{ ...stickyCol, textAlign: 'left' }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  Class average
                </Typography>
              </Box>
              {topicAverages.map((v, i) => (
                <td key={topics[i]}>{cell(v, `Class average, ${topics[i]}`)}</td>
              ))}
              <td />
            </tr>
            {rows.map((s) => (
              <tr key={s.id}>
                <Box component="th" scope="row" sx={{ ...stickyCol, textAlign: 'left', maxWidth: 200 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                    {s.name}
                  </Typography>
                </Box>
                {topics.map((t) => (
                  <td key={t}>{cell(s.mastery?.[t], `${s.name}, ${t}`)}</td>
                ))}
                <Box component="td" sx={{ textAlign: 'center', fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                  {s.average === null ? '—' : Math.round(s.average)}
                </Box>
              </tr>
            ))}
          </tbody>
        </Box>
      </Box>
    </Box>
  );
}

export default function CourseAnalyticsTab({ analytics }) {
  const { data, error, loading, reload } = analytics;
  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t load analytics" />;

  const topics = data?.topicMastery?.topics || [];
  const students = data?.topicMastery?.students || [];
  const summaries = data?.assessmentSummaries || [];

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <SectionCard
        title="Topic mastery"
        subtitle="Points earned ÷ points available on each topic’s questions, using each student’s best graded attempt at each assessment."
      >
        {loading ? (
          <Skeleton variant="rounded" height={320} />
        ) : !topics.length || !students.length ? (
          <EmptyState
            compact
            icon={<InsightsOutlinedIcon />}
            title="No mastery data yet"
            description="Give questions a topic and publish an assessment. Mastery appears once students submit."
          />
        ) : (
          <Heatmap topics={topics} students={students} />
        )}
      </SectionCard>

      <SectionCard title="Assessment summaries" padding={0} sx={{ '& > div:first-of-type': { px: 2.5 } }}>
        {loading ? (
          <Box sx={{ p: 2.5 }}>
            <Skeleton variant="rounded" height={160} />
          </Box>
        ) : !summaries.length ? (
          <Box sx={{ p: 2.5 }}>
            <EmptyState compact title="No published assessments" description="Summaries appear once an assessment is published." />
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={0}>
            <Table size="small" sx={{ minWidth: 760 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Assessment</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Submitted</TableCell>
                  <TableCell align="right">Average</TableCell>
                  <TableCell align="right">Median</TableCell>
                  <TableCell align="right">High / Low</TableCell>
                  <TableCell align="right">Pass rate</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.id} hover>
                    <TableCell>
                      <Link component={RouterLink} to={`/app/assessments/${s.id}/analytics`} underline="hover" sx={{ fontWeight: 600, color: 'text.primary' }}>
                        {s.title}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <AssessmentStatusChip status={s.status} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.submissions}/{s.enrolled}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                      {formatPercent(s.averageScore, '—', 1)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatPercent(s.median, '—', 1)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.highest === null || s.highest === undefined ? '—' : `${Math.round(s.highest)} / ${Math.round(s.lowest)}`}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatPercent(s.passRate, '—', 1)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </SectionCard>
    </Box>
  );
}
