import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../../common';
import { ErrorState, MobileList, MobileRow, SubmissionStatusChip, TableSkeleton, ToneChip, useIsMobile } from '../StaffUI';
import { formatDateTime, formatDuration, formatPercent, pluralize, scoreTone } from '../staffUtils';
import { useDebouncedValue } from '../useApiData';

const PAGE_SIZE = 25;

export default function AssessmentSubmissionsTab({ assessment: a, submissions }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState('all');
  const [onlyReview, setOnlyReview] = useState(params.get('review') === '1');
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebouncedValue(search.trim().toLowerCase(), 300);
  const isMobile = useIsMobile();
  const { data, error, loading, reload } = submissions;

  const rows = useMemo(
    () =>
      (data?.items || []).filter(
        (s) =>
          (status === 'all' || s.status === status) &&
          (!onlyReview || s.needsReview) &&
          (!onlyFlagged || s.violationCount > 0 || s.plagiarismFlag || s.status === 'terminated') &&
          (!q || s.student?.name?.toLowerCase().includes(q) || s.student?.email?.toLowerCase().includes(q))
      ),
    [data, status, onlyReview, onlyFlagged, q]
  );

  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t load submissions" />;
  const total = data?.items?.length || 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search students"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          inputProps={{ 'aria-label': 'Search students' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchRoundedIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: { xs: '100%', sm: 240 } }}
        />
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel id="sub-status">Status</InputLabel>
          <Select
            labelId="sub-status"
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="all">All statuses</MenuItem>
            <MenuItem value="submitted">Submitted</MenuItem>
            <MenuItem value="terminated">Terminated</MenuItem>
            <MenuItem value="in-progress">In progress</MenuItem>
          </Select>
        </FormControl>
        <Chip
          icon={<RateReviewOutlinedIcon />}
          label="Needs review"
          variant={onlyReview ? 'filled' : 'outlined'}
          color={onlyReview ? 'warning' : 'default'}
          onClick={() => {
            setOnlyReview((v) => !v);
            setPage(0);
          }}
          aria-pressed={onlyReview}
        />
        <Chip
          icon={<FlagOutlinedIcon />}
          label="Flagged"
          variant={onlyFlagged ? 'filled' : 'outlined'}
          color={onlyFlagged ? 'error' : 'default'}
          onClick={() => {
            setOnlyFlagged((v) => !v);
            setPage(0);
          }}
          aria-pressed={onlyFlagged}
        />
        {!loading && (
          <Typography variant="body2" sx={{ color: 'text.secondary', ml: { sm: 'auto' } }}>
            {rows.length === total ? pluralize(total, 'attempt') : `${rows.length} of ${pluralize(total, 'attempt')}`}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <TableSkeleton rows={6} columns={7} />
        </Paper>
      ) : total === 0 ? (
        <EmptyState
          icon={<TaskAltRoundedIcon />}
          title="No submissions yet"
          description={a.status === 'draft' ? 'Publish the assessment so students can take it.' : 'Attempts appear here as soon as students start.'}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          compact
          title="No matching attempts"
          action={
            <Button
              onClick={() => {
                setStatus('all');
                setOnlyFlagged(false);
                setOnlyReview(false);
                setSearch('');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : isMobile ? (
        <Box>
          <MobileList label="Submissions">
            {rows.slice(0, (page + 1) * PAGE_SIZE).map((s) => (
              <MobileRow
                key={s.id}
                title={s.student?.name}
                to={`/app/submissions/${s.id}`}
                subtitle={`Attempt ${s.attempt} · ${s.submittedAt ? formatDateTime(s.submittedAt) : 'in progress'}`}
                chips={
                  <>
                    <SubmissionStatusChip status={s.status} />
                    {s.needsReview && <ToneChip label="Needs review" tone="warning" />}
                    {s.violationCount > 0 && <ToneChip label={pluralize(s.violationCount, 'violation')} tone="error" />}
                    {s.plagiarismFlag && <ToneChip label="Similarity" tone="error" />}
                  </>
                }
                meta={[
                  {
                    label: 'Score',
                    value: s.status === 'in-progress' ? '—' : `${formatPercent(s.percentage, '—', s.percentage % 1 ? 1 : 0)} (${s.score}/${s.maxScore})`,
                  },
                  { label: 'Time', value: formatDuration(s.timeSpent) },
                ]}
              />
            ))}
          </MobileList>
          {rows.length > (page + 1) * PAGE_SIZE && (
            <Button fullWidth sx={{ mt: 1.5 }} onClick={() => setPage((p) => p + 1)}>
              Show more
            </Button>
          )}
        </Box>
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <TableContainer>
            <Table sx={{ minWidth: 860 }} aria-label="Submissions">
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell align="center">Attempt</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Score</TableCell>
                  <TableCell align="right">Time</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell>Flags</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((s) => {
                  const open = () => navigate(`/app/submissions/${s.id}`);
                  return (
                    <TableRow
                      key={s.id}
                      hover
                      tabIndex={0}
                      onClick={open}
                      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open())}
                      sx={{ cursor: 'pointer', '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 } }}
                      aria-label={`Open ${s.student?.name}'s attempt ${s.attempt}`}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {s.student?.name}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {s.student?.email}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">{s.attempt}</TableCell>
                      <TableCell>
                        <SubmissionStatusChip status={s.status} />
                      </TableCell>
                      <TableCell align="right">
                        {s.status === 'in-progress' ? (
                          '—'
                        ) : (
                          <Box>
                            <ToneChip label={formatPercent(s.percentage, '—', s.percentage % 1 ? 1 : 0)} tone={scoreTone(s.percentage, a.passingScore)} />
                            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.25 }}>
                              {s.score}/{s.maxScore}
                              {s.overridden ? ' · overridden' : ''}
                            </Typography>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {formatDuration(s.timeSpent)}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{s.submittedAt ? formatDateTime(s.submittedAt) : `Started ${formatDateTime(s.startedAt)}`}</Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {s.needsReview && <ToneChip label="Needs review" tone="warning" icon={<RateReviewOutlinedIcon />} />}
                          {s.violationCount > 0 && (
                            <Tooltip title="Integrity events recorded during the attempt">
                              <span>
                                <ToneChip label={`${s.violationCount} violation${s.violationCount === 1 ? '' : 's'}`} tone="error" />
                              </span>
                            </Tooltip>
                          )}
                          {s.plagiarismFlag && <ToneChip label="Similarity" tone="error" icon={<FlagOutlinedIcon />} />}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          {rows.length > PAGE_SIZE && (
            <TablePagination
              component="div"
              count={rows.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={PAGE_SIZE}
              rowsPerPageOptions={[PAGE_SIZE]}
            />
          )}
        </Paper>
      )}
    </Box>
  );
}
