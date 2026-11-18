import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import {
  Box,
  Button,
  IconButton,
  Link,
  Menu,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import React, { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { listAssessments } from '../../../api/assessments';
import { EmptyState } from '../../common';
import { AssessmentStatusChip, ErrorState, MobileList, MobileRow, ScoreBar, TableSkeleton, ToneChip, useIsMobile } from '../StaffUI';
import { formatDateTime, formatPercent, formatRelative, pluralize, scoreTone } from '../staffUtils';
import useApiData from '../useApiData';
import useAssessmentActions, { ACTION_LABELS, availableActions } from '../useAssessmentActions';

function RowMenu({ assessment, onAction }) {
  const [anchor, setAnchor] = useState(null);
  const actions = availableActions(assessment);
  return (
    <>
      <IconButton size="small" aria-label={`Actions for ${assessment.title}`} onClick={(e) => setAnchor(e.currentTarget)}>
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {actions.map((act) => (
          <MenuItem
            key={act}
            onClick={() => {
              setAnchor(null);
              onAction(act, assessment);
            }}
            sx={act === 'archive' ? { color: 'error.main' } : undefined}
          >
            {act === 'edit' && assessment.status !== 'draft' ? 'Edit settings' : ACTION_LABELS[act]}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

export default function CourseAssessmentsTab({ courseId, reloadCourse }) {
  const [status, setStatus] = useState('all');
  const archivedView = status === 'archived';
  const { data, error, loading, reload } = useApiData(
    () => listAssessments({ courseId, pageSize: 100, ...(archivedView ? { status: 'archived' } : {}) }),
    [courseId, archivedView]
  );
  const isMobile = useIsMobile();
  const { run, dialog } = useAssessmentActions({
    onChanged: () => {
      reload({ silent: true });
      reloadCourse();
    },
  });
  const items = useMemo(() => data?.items || [], [data]);
  const counts = useMemo(
    () => items.reduce((acc, a) => ({ ...acc, [a.status]: (acc[a.status] || 0) + 1 }), {}),
    [items]
  );
  const rows = status === 'all' || archivedView ? items : items.filter((a) => a.status === status);
  const newLink = `/app/assessments/new?courseId=${courseId}`;

  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t load assessments" />;

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', mb: 2 }}>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={status}
          onChange={(_, v) => v && setStatus(v)}
          aria-label="Filter by status"
          sx={{ flexWrap: 'wrap' }}
        >
          <ToggleButton value="all">All {items.length && !archivedView ? `(${items.length})` : ''}</ToggleButton>
          {['draft', 'published', 'closed'].map((s) => (
            <ToggleButton key={s} value={s} sx={{ textTransform: 'capitalize' }}>
              {s} {counts[s] && !archivedView ? `(${counts[s]})` : ''}
            </ToggleButton>
          ))}
          <ToggleButton value="archived">Archived</ToggleButton>
        </ToggleButtonGroup>
        <Button variant="contained" startIcon={<AddRoundedIcon />} component={RouterLink} to={newLink}>
          New assessment
        </Button>
      </Box>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <TableSkeleton rows={4} columns={6} />
        </Paper>
      ) : items.length === 0 && archivedView ? (
        <EmptyState
          compact
          title="No archived assessments"
          description="Archived assessments keep their submissions and grades, and can be restored as drafts."
          action={<Button onClick={() => setStatus('all')}>Show active</Button>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<AssignmentOutlinedIcon />}
          title="No assessments yet"
          description="Write questions yourself, generate them from your syllabus with AI, or reuse questions from the bank."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} component={RouterLink} to={newLink}>
              New assessment
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState compact title={`No ${status} assessments`} action={<Button onClick={() => setStatus('all')}>Show all</Button>} />
      ) : isMobile ? (
        <MobileList label="Assessments">
          {rows.map((a) => (
            <MobileRow
              key={a.id}
              title={a.title}
              to={a.status === 'draft' ? `/app/assessments/${a.id}/edit` : `/app/assessments/${a.id}`}
              subtitle={`${pluralize(a.questionCount || 0, 'question')} · ${a.totalPoints ?? 0} pts${a.timeLimit ? ` · ${a.timeLimit} min` : ''}`}
              chips={<AssessmentStatusChip status={a.status} />}
              action={<RowMenu assessment={a} onAction={run} />}
              meta={[
                { label: 'Due', value: a.dueDate ? formatDateTime(a.dueDate) : 'No due date' },
                { label: 'Submissions', value: a.status === 'draft' ? '—' : a.submissionCount ?? 0 },
                { label: 'Average', value: formatPercent(a.averageScore) },
              ]}
            />
          ))}
        </MobileList>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
          <Table sx={{ minWidth: 720 }} aria-label="Assessments">
            <TableHead>
              <TableRow>
                <TableCell>Assessment</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Due</TableCell>
                <TableCell align="right">Submissions</TableCell>
                <TableCell>Average</TableCell>
                <TableCell align="right" width={56}>
                  <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                    Actions
                  </Box>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((a) => {
                const overdue = a.dueDate && new Date(a.dueDate) < new Date();
                return (
                  <TableRow key={a.id} hover>
                    <TableCell sx={{ maxWidth: 360 }}>
                      <Link
                        component={RouterLink}
                        to={a.status === 'draft' ? `/app/assessments/${a.id}/edit` : `/app/assessments/${a.id}`}
                        underline="hover"
                        sx={{ fontWeight: 600, color: 'text.primary' }}
                      >
                        {a.title}
                      </Link>
                      <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
                        {pluralize(a.questionCount || 0, 'question')} · {a.totalPoints ?? 0} pts
                        {a.timeLimit ? ` · ${a.timeLimit} min` : ''}
                        {a.proctoring?.enabled ? ' · Proctored' : ''}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        <AssessmentStatusChip status={a.status} />
                        {a.resultsPolicy === 'manual' && a.status !== 'draft' && !a.resultsReleased && (
                          <ToneChip label="Results hidden" tone="warning" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      {a.dueDate ? (
                        <>
                          <Typography variant="body2">{formatDateTime(a.dueDate)}</Typography>
                          <Typography variant="caption" sx={{ color: overdue ? 'text.secondary' : 'primary.main' }}>
                            {formatRelative(a.dueDate)}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          No due date
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {a.status === 'draft' ? '—' : a.submissionCount ?? 0}
                    </TableCell>
                    <TableCell>
                      <ScoreBar value={a.averageScore} tone={scoreTone(a.averageScore, a.passingScore) === 'error' ? 'error' : 'primary'} width={64} />
                    </TableCell>
                    <TableCell align="right">
                      <RowMenu assessment={a} onAction={run} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {dialog}
    </Box>
  );
}
