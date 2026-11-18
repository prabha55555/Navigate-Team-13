import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import {
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Container,
  MenuItem,
  Paper,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { listCourses } from '../../api/courses';
import { getMySubmissions } from '../../api/submissions';
import { EmptyState, PageHeader, useAsync } from '../../components/common';
import { formatDateTime, formatDuration, formatPercent, scoreTone } from '../../components/learner/format';
import { CourseDot, ErrorState, ToneChip } from '../../components/learner/ui';

const PAGE_SIZE = 50;

const STATUS_FILTERS = [
  { value: 'all', label: 'All statuses' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Not passed' },
  { value: 'pending', label: 'Awaiting release' },
  { value: 'terminated', label: 'Ended early' },
];

const TYPE_FILTERS = [
  { value: 'graded', label: 'Graded work' },
  { value: 'practice', label: 'Practice quizzes' },
  { value: 'all', label: 'Everything' },
];

const statusOf = (s) => {
  if (s.status === 'terminated') return 'terminated';
  if (!s.released || s.percentage == null) return 'pending';
  return s.isPassed ? 'passed' : 'failed';
};

const StatusChip = ({ s }) => {
  const st = statusOf(s);
  if (st === 'terminated') return <ToneChip tone="error" label="Ended early" />;
  if (st === 'pending') return <ToneChip label="Awaiting release" />;
  return <ToneChip tone={st === 'passed' ? 'success' : 'error'} label={st === 'passed' ? 'Passed' : 'Not passed'} />;
};

const Score = ({ s }) => {
  const theme = useTheme();
  if (!s.released || s.percentage == null) {
    return (
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        —
      </Typography>
    );
  }
  const tone = scoreTone(s.percentage);
  return (
    <Box sx={{ textAlign: 'right' }}>
      <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: theme.palette.mode === 'dark' ? `${tone}.light` : `${tone}.dark` }}>
        {formatPercent(s.percentage, 1)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
        {s.score}/{s.maxScore}
      </Typography>
    </Box>
  );
};

export default function ResultsHistory() {
  const theme = useTheme();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [params, setParams] = useSearchParams();
  const courseId = params.get('course') || '';
  const status = params.get('status') || 'all';
  const type = params.get('type') || 'graded';

  const [pages, setPages] = useState({ items: [], total: 0, page: 1, loadingMore: false, moreError: null });


  const courses = useAsync(() => listCourses({ pageSize: 100 }), []);

  const fetchPage = useCallback(
    (page) =>
      getMySubmissions({
        page,
        pageSize: PAGE_SIZE,
        courseId: courseId || undefined,
        practice: type === 'all' ? undefined : type === 'practice',
      }),
    [courseId, type]
  );

  const first = useAsync(() => fetchPage(1), [fetchPage]);

  useEffect(() => {
    if (first.data) setPages({ items: first.data.items || [], total: first.data.total || 0, page: 1, loadingMore: false, moreError: null });
  }, [first.data]);

  const loadMore = async () => {
    setPages((p) => ({ ...p, loadingMore: true, moreError: null }));
    try {
      const next = await fetchPage(pages.page + 1);
      setPages((p) => ({ ...p, items: [...p.items, ...(next.items || [])], total: next.total ?? p.total, page: p.page + 1, loadingMore: false }));
    } catch (err) {
      setPages((p) => ({ ...p, loadingMore: false, moreError: err }));
    }
  };

  const setFilter = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (!value || value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const visible = useMemo(
    () =>
      pages.items.filter((s) => {
        if (status !== 'all' && statusOf(s) !== status) return false;
        return true;
      }),
    [pages.items, status]
  );

  const hasMore = pages.items.length < pages.total;
  const filtersActive = Boolean(courseId) || status !== 'all' || type !== 'graded';

  const filters = (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 220px))' }, gap: 1.5 }}>
      <TextField select size="small" label="Course" value={courseId} onChange={(e) => setFilter('course', e.target.value, '')} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
        <MenuItem value="">All courses</MenuItem>
        {(courses.data?.items || []).map((c) => (
          <MenuItem key={c.id} value={c.id}>
            {c.title}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Status" value={status} onChange={(e) => setFilter('status', e.target.value, 'all')}>
        {STATUS_FILTERS.map((f) => (
          <MenuItem key={f.value} value={f.value}>
            {f.label}
          </MenuItem>
        ))}
      </TextField>
      <TextField select size="small" label="Type" value={type} onChange={(e) => setFilter('type', e.target.value, 'graded')}>
        {TYPE_FILTERS.map((f) => (
          <MenuItem key={f.value} value={f.value}>
            {f.label}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );

  let content;
  if (first.loading && !first.data) {
    content = (
      <Paper variant="outlined" sx={{ borderRadius: 4, p: 2 }} aria-busy="true" aria-label="Loading results">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={56} />
        ))}
      </Paper>
    );
  } else if (first.error && !first.data) {
    content = <ErrorState error={first.error} onRetry={first.reload} title="We couldn't load your results" />;
  } else if (!visible.length && !hasMore) {
    content = (
      <EmptyState
        icon={<FactCheckOutlinedIcon />}
        title={filtersActive ? 'No results match these filters' : 'No results yet'}
        description={filtersActive ? 'Try a different course or status.' : 'When you submit an assessment, your result will appear here.'}
        action={
          filtersActive ? (
            <Button variant="outlined" onClick={() => setParams(new URLSearchParams(), { replace: true })}>
              Clear filters
            </Button>
          ) : (
            <Button variant="contained" component={RouterLink} to="/app">
              Go to dashboard
            </Button>
          )
        }
      />
    );
  } else if (isMobile) {
    content = (
      <Box component="ul" sx={{ p: 0, m: 0, display: 'grid', gap: 1.5 }}>
        {visible.map((s) => (
          <Box component="li" key={s.id} sx={{ listStyle: 'none' }}>
            <ButtonBase
              component={RouterLink}
              to={`/app/results/${s.id}`}
              sx={{
                width: '100%',
                display: 'block',
                textAlign: 'left',
                p: 2,
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600 }}>{s.assessment?.title}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CourseDot color={s.course?.color} size={8} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {s.course?.title}
                    </Typography>
                  </Box>
                </Box>
                <Score s={s} />
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.25, flexWrap: 'wrap' }}>
                <StatusChip s={s} />
                {s.isPractice && <ToneChip label="Practice" />}
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {formatDateTime(s.submittedAt)} · Attempt {s.attempt} · {formatDuration(s.timeSpent)}
                </Typography>
              </Box>
            </ButtonBase>
          </Box>
        ))}
      </Box>
    );
  } else {
    content = (
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
        <Table aria-label="My results">
          <TableHead>
            <TableRow>
              <TableCell>Assessment</TableCell>
              <TableCell>Submitted</TableCell>
              <TableCell align="center">Attempt</TableCell>
              <TableCell align="right">Time</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Score</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visible.map((s) => (
              <TableRow
                key={s.id}
                hover
                onClick={() => navigate(`/app/results/${s.id}`)}
                sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}
              >
                <TableCell sx={{ maxWidth: 360 }}>
                  <Typography
                    component={RouterLink}
                    to={`/app/results/${s.id}`}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ fontWeight: 600, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    {s.assessment?.title}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <CourseDot color={s.course?.color} size={8} />
                    <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                      {s.course?.title}
                      {s.isPractice ? ' · Practice' : ''}
                    </Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary' }}>{formatDateTime(s.submittedAt)}</TableCell>
                <TableCell align="center" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {s.attempt}
                </TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                  {formatDuration(s.timeSpent)}
                </TableCell>
                <TableCell>
                  <StatusChip s={s} />
                </TableCell>
                <TableCell align="right">
                  <Score s={s} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <Container maxWidth="lg">
      <PageHeader eyebrow="Results" title="My results" description="Every assessment you've submitted, with scores once they're released.">
        {filters}
      </PageHeader>
      {content}
      {first.data && hasMore && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mt: 3 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Showing {pages.items.length} of {pages.total}
          </Typography>
          <Button variant="outlined" onClick={loadMore} disabled={pages.loadingMore} startIcon={pages.loadingMore ? <CircularProgress size={16} /> : null}>
            {pages.moreError ? 'Retry' : 'Load more'}
          </Button>
        </Box>
      )}
    </Container>
  );
}
