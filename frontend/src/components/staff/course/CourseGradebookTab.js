import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import { Box, Button, ButtonBase, CircularProgress, Link, Paper, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { listAssessments } from '../../../api/assessments';
import { downloadGradebookCsv, getGradebook } from '../../../api/courses';
import { EmptyState } from '../../common';
import { ErrorState, TableSkeleton } from '../StaffUI';
import { formatPercent, formatShortDate } from '../staffUtils';
import useApiData from '../useApiData';
import usePlanError from '../usePlanError';

const cellKind = (cell, passingScore) => {
  if (!cell || cell.status === 'not-started') return 'empty';
  if (cell.status === 'missing') return 'missing';
  if (cell.status === 'in-progress') return 'progress';
  if (cell.percentage === null || cell.percentage === undefined) return 'empty';
  return cell.percentage >= passingScore ? 'pass' : 'fail';
};

const KIND_TONE = { pass: 'success', fail: 'error', missing: 'warning', progress: 'info' };
const LEGEND = [
  { kind: 'pass', label: 'Passed' },
  { kind: 'fail', label: 'Below pass mark' },
  { kind: 'missing', label: 'Missing (past due)' },
  { kind: 'progress', label: 'In progress' },
];

export default function CourseGradebookTab({ course, courseId }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const handleError = usePlanError();
  const [exporting, setExporting] = useState(false);
  const { data, error, loading, reload } = useApiData(
    () => Promise.all([getGradebook(courseId), listAssessments({ courseId, pageSize: 100 })]),
    [courseId]
  );
  const [gradebook, list] = data || [];

  const passing = useMemo(() => new Map((list?.items || []).map((a) => [a.id, a.passingScore ?? 50])), [list]);
  const columns = useMemo(() => gradebook?.assessments || [], [gradebook]);
  const rows = useMemo(() => gradebook?.rows || [], [gradebook]);
  const averages = useMemo(
    () =>
      columns.map((a) => {
        const vals = rows.map((r) => r.scores?.[a.id]).filter((c) => c && typeof c.percentage === 'number' && c.status !== 'in-progress');
        return vals.length ? vals.reduce((s, c) => s + c.percentage, 0) / vals.length : null;
      }),
    [columns, rows]
  );

  // Only explain the colours that actually appear in the grid.
  const presentKinds = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => columns.forEach((a) => set.add(cellKind(r.scores?.[a.id], passing.get(a.id) ?? 50))));
    return set;
  }, [rows, columns, passing]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadGradebookCsv(courseId, `${course.code || 'course'}-gradebook.csv`);
    } catch (err) {
      handleError(err, 'Could not export the gradebook');
    } finally {
      setExporting(false);
    }
  };

  const tonePalette = (kind) => theme.palette[KIND_TONE[kind]];
  const cellSx = (kind) => {
    const pal = tonePalette(kind);
    return {
      width: '100%',
      minHeight: 36,
      px: 1,
      borderRadius: 1.5,
      justifyContent: 'center',
      gap: 0.5,
      fontWeight: 600,
      fontSize: 13,
      fontVariantNumeric: 'tabular-nums',
      color: pal ? (theme.palette.mode === 'dark' ? pal.light : pal.dark) : 'text.disabled',
      bgcolor: pal ? alpha(pal.main, theme.palette.mode === 'dark' ? 0.22 : 0.12) : 'transparent',
      '&:hover': pal ? { bgcolor: alpha(pal.main, 0.24) } : undefined,
      '&.Mui-focusVisible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 1 },
    };
  };

  if (error) return <ErrorState error={error} onRetry={reload} title="We couldn’t load the gradebook" />;

  const stickyCol = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    borderRight: '1px solid',
    borderRightColor: 'divider',
  };
  const th = {
    position: 'sticky',
    top: 0,
    zIndex: 3,
    bgcolor: 'background.paper',
    borderBottom: '1px solid',
    borderBottomColor: 'divider',
    p: 1,
    textAlign: 'left',
    verticalAlign: 'bottom',
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }} aria-label="Legend">
          {LEGEND.filter((l) => presentKinds.has(l.kind)).map((l) => {
            const pal = tonePalette(l.kind);
            return (
              <Box key={l.kind} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box sx={{ width: 14, height: 14, borderRadius: 0.75, bgcolor: alpha(pal.main, 0.3), border: `1px solid ${alpha(pal.main, 0.6)}` }} />
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {l.label}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Button
          variant="outlined"
          color="inherit"
          startIcon={exporting ? <CircularProgress size={16} /> : <DownloadRoundedIcon />}
          onClick={exportCsv}
          disabled={exporting || loading || !rows.length}
        >
          Export CSV
        </Button>
      </Box>

      {loading ? (
        <Paper variant="outlined" sx={{ borderRadius: 4 }}>
          <TableSkeleton rows={8} columns={5} />
        </Paper>
      ) : !columns.length || !rows.length ? (
        <EmptyState
          icon={<GridOnOutlinedIcon />}
          title={!rows.length ? 'No students yet' : 'Nothing to grade yet'}
          description={
            !rows.length
              ? 'Once students join, their scores on every published assessment appear here.'
              : 'Published assessments appear here as columns, with each student’s best attempt.'
          }
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <Box sx={{ overflow: 'auto', maxHeight: '70vh' }}>
            <Box component="table" sx={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 200 + columns.length * 130 }}>
              <caption style={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                Gradebook: best attempt per student and assessment
              </caption>
              <thead>
                <tr>
                  <Box component="th" scope="col" sx={{ ...th, ...stickyCol, zIndex: 4, minWidth: { xs: 140, sm: 200 }, pl: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      Student
                    </Typography>
                  </Box>
                  {columns.map((a) => (
                    <Box component="th" scope="col" key={a.id} sx={{ ...th, minWidth: 120, maxWidth: 160 }}>
                      <Tooltip title={a.title}>
                        <Link
                          component={RouterLink}
                          to={`/app/assessments/${a.id}`}
                          underline="hover"
                          variant="caption"
                          sx={{ fontWeight: 700, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: 'text.primary' }}
                        >
                          {a.title}
                        </Link>
                      </Tooltip>
                      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                        {a.dueDate ? `Due ${formatShortDate(a.dueDate)}` : 'No due date'} · {a.totalPoints} pts
                      </Typography>
                    </Box>
                  ))}
                  <Box component="th" scope="col" sx={{ ...th, minWidth: 90, textAlign: 'right', pr: 2 }}>
                    <Typography variant="caption" sx={{ fontWeight: 700 }}>
                      Average
                    </Typography>
                  </Box>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <Box component="tr" key={r.student.id} sx={{ '&:hover td, &:hover th': { bgcolor: 'action.hover' } }}>
                    <Box component="th" scope="row" sx={{ ...stickyCol, p: 1, pl: 2, textAlign: 'left', borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {r.student.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }} noWrap>
                        {r.student.email}
                      </Typography>
                    </Box>
                    {columns.map((a) => {
                      const cell = r.scores?.[a.id];
                      const kind = cellKind(cell, passing.get(a.id) ?? 50);
                      const label =
                        kind === 'missing'
                          ? 'Missing'
                          : kind === 'progress'
                            ? 'In progress'
                            : kind === 'empty'
                              ? '—'
                              : formatPercent(cell.percentage, '—', cell.percentage % 1 ? 1 : 0);
                      const desc = `${r.student.name}, ${a.title}: ${kind === 'empty' ? 'not started' : label}${cell?.status === 'terminated' ? ', terminated attempt' : ''}`;
                      return (
                        <Box component="td" key={a.id} sx={{ p: 0.5, borderBottom: '1px solid', borderBottomColor: 'divider' }}>
                          {cell?.submissionId ? (
                            <ButtonBase
                              sx={cellSx(kind)}
                              aria-label={`${desc}. Open submission`}
                              title={cell.status === 'terminated' ? 'Attempt was terminated (integrity violations)' : 'Open submission'}
                              onClick={() => navigate(`/app/submissions/${cell.submissionId}`)}
                            >
                              {cell.status === 'terminated' && <ReportProblemOutlinedIcon sx={{ fontSize: 14 }} />}
                              {label}
                            </ButtonBase>
                          ) : (
                            <Box sx={{ ...cellSx(kind), display: 'flex', alignItems: 'center' }} aria-label={desc}>
                              {label}
                            </Box>
                          )}
                        </Box>
                      );
                    })}
                    <Box
                      component="td"
                      sx={{ p: 1, pr: 2, textAlign: 'right', fontWeight: 700, fontVariantNumeric: 'tabular-nums', borderBottom: '1px solid', borderBottomColor: 'divider' }}
                    >
                      {formatPercent(r.average, '—', 1)}
                    </Box>
                  </Box>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Box component="th" scope="row" sx={{ ...stickyCol, p: 1, pl: 2, textAlign: 'left', bottom: 0, position: 'sticky', zIndex: 3 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      Class average
                    </Typography>
                  </Box>
                  {averages.map((v, i) => (
                    <Box
                      component="td"
                      key={columns[i].id}
                      sx={{ p: 1, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums', position: 'sticky', bottom: 0, bgcolor: 'background.paper' }}
                    >
                      {formatPercent(v, '—', 1)}
                    </Box>
                  ))}
                  <Box component="td" sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper' }} />
                </tr>
              </tfoot>
            </Box>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
