import GroupAddOutlinedIcon from '@mui/icons-material/GroupAddOutlined';
import PersonRemoveOutlinedIcon from '@mui/icons-material/PersonRemoveOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import {
  Autocomplete,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { addInstructor, getRoster, removeInstructor, removeStudent } from '../../../api/courses';
import { listMembers } from '../../../api/workspace';
import { useAuth } from '../../../contexts/AuthContext';
import { useNotify } from '../../../contexts/NotificationContext';
import { EmptyState } from '../../common';
import ConfirmDialog from '../ConfirmDialog';
import { ErrorState, MobileList, MobileRow, ScoreBar, SectionCard, TableSkeleton, useIsMobile } from '../StaffUI';
import { formatDate, formatRelative, initials, scoreTone } from '../staffUtils';
import useApiData, { useDebouncedValue } from '../useApiData';
import usePlanError from '../usePlanError';

const PAGE_SIZE = 25;

function CoInstructors({ course, patchCourse }) {
  const { currentUser } = useAuth();
  const notify = useNotify();
  const handleError = usePlanError();
  const canManage = ['owner', 'admin'].includes(currentUser?.role);
  const staff = useApiData(() => listMembers({ pageSize: 200 }), [], { enabled: canManage });
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState(null);
  const instructorIds = new Set((course.instructors || []).map((i) => i.id));
  const candidates = (staff.data?.items || []).filter((m) => m.role !== 'student' && !m.deactivated && !instructorIds.has(m.id));

  const add = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await addInstructor(course.id, selected.id);
      patchCourse({ instructors: updated.instructors || [...course.instructors, { id: selected.id, name: selected.name, email: selected.email }] });
      notify(`${selected.name} can now manage this course`, 'success');
      setSelected(null);
    } catch (err) {
      handleError(err, 'Could not add the instructor');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    try {
      const updated = await removeInstructor(course.id, removing.id);
      patchCourse({ instructors: updated.instructors || course.instructors.filter((i) => i.id !== removing.id) });
      notify(`${removing.name} removed from this course`, 'success');
      setRemoving(null);
    } catch (err) {
      handleError(err, 'Could not remove the instructor');
    }
  };

  return (
    <SectionCard
      title="Instructors"
      subtitle={canManage ? 'Co-instructors have full access to this course.' : 'Ask a workspace admin to add co-instructors.'}
    >
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: canManage ? 2 : 0 }}>
        {(course.instructors || []).map((i) => (
          <Chip
            key={i.id}
            avatar={<Avatar>{initials(i.name)}</Avatar>}
            label={i.name}
            variant="outlined"
            onDelete={canManage && course.instructors.length > 1 ? () => setRemoving(i) : undefined}
            deleteIcon={<PersonRemoveOutlinedIcon aria-label={`Remove ${i.name} from this course`} />}
          />
        ))}
      </Box>
      {canManage && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Autocomplete
            size="small"
            options={candidates}
            loading={staff.loading}
            value={selected}
            onChange={(_, v) => setSelected(v)}
            getOptionLabel={(o) => `${o.name} (${o.email})`}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            noOptionsText={staff.error ? 'Could not load staff' : 'No other staff members'}
            sx={{ flex: '1 1 260px', maxWidth: 420 }}
            renderInput={(params) => <TextField {...params} label="Add a co-instructor" />}
          />
          <Button variant="outlined" onClick={add} disabled={!selected || busy} startIcon={busy ? <CircularProgress size={16} /> : null}>
            Add
          </Button>
        </Box>
      )}
      <ConfirmDialog
        open={!!removing}
        title="Remove co-instructor?"
        description={`${removing?.name} will lose access to this course. Their past grading is kept.`}
        confirmLabel="Remove"
        tone="error"
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </SectionCard>
  );
}

export default function CourseStudentsTab({ course, courseId, onInvite, patchCourse, reloadCourse }) {
  const notify = useNotify();
  const handleError = usePlanError();
  const { data, error, loading, reload } = useApiData(() => getRoster(courseId), [courseId, course.studentCount]);
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim().toLowerCase(), 300);
  const isMobile = useIsMobile();
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [removing, setRemoving] = useState(null);

  const rows = useMemo(() => {
    const list = (data?.items || data || []).filter((s) => !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * dir;
    });
  }, [data, q, sort]);

  const toggleSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : key === 'name' ? 'asc' : 'desc' }));

  const remove = async () => {
    try {
      await removeStudent(courseId, removing.id);
      notify(`${removing.name} removed from the course`, 'success');
      setRemoving(null);
      reloadCourse();
      reload({ silent: true });
    } catch (err) {
      handleError(err, 'Could not remove the student');
    }
  };

  const header = (key, label, align) => (
    <TableCell align={align} sortDirection={sort.key === key ? sort.dir : false}>
      <TableSortLabel active={sort.key === key} direction={sort.key === key ? sort.dir : 'asc'} onClick={() => toggleSort(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  const total = (data?.items || data || []).length;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <SectionCard
        title="Students"
        subtitle={loading ? ' ' : `${total} enrolled`}
        padding={0}
        action={
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', pr: 2.5 }}>
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
              sx={{ width: { xs: '100%', sm: 220 } }}
            />
            <Button variant="contained" startIcon={<GroupAddOutlinedIcon />} onClick={() => onInvite('email')}>
              Add students
            </Button>
          </Box>
        }
        sx={{ '& > div:first-of-type': { pl: 2.5 } }}
      >
        {error ? (
          <Box sx={{ p: 2.5 }}>
            <ErrorState error={error} onRetry={reload} title="We couldn’t load the roster" />
          </Box>
        ) : loading ? (
          <TableSkeleton rows={6} columns={5} />
        ) : total === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <EmptyState
              icon={<GroupAddOutlinedIcon />}
              title="No students enrolled"
              description="Share the course join code, or add students who already have an account by email."
              action={
                <>
                  <Button variant="outlined" onClick={() => onInvite('share')}>
                    Share join code
                  </Button>
                  <Button variant="contained" onClick={() => onInvite('email')}>
                    Add by email
                  </Button>
                </>
              }
            />
          </Box>
        ) : rows.length === 0 ? (
          <Box sx={{ p: 2.5 }}>
            <EmptyState compact icon={<SearchRoundedIcon />} title="No matching students" action={<Button onClick={() => setSearch('')}>Clear search</Button>} />
          </Box>
        ) : isMobile ? (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <MobileList label="Course roster">
              {rows.slice(0, (page + 1) * PAGE_SIZE).map((s) => (
                <MobileRow
                  key={s.id}
                  title={s.name}
                  subtitle={s.email}
                  action={
                    <IconButton size="small" aria-label={`Remove ${s.name} from the course`} onClick={() => setRemoving(s)}>
                      <PersonRemoveOutlinedIcon fontSize="small" />
                    </IconButton>
                  }
                  meta={[
                    { label: 'Average', value: <ScoreBar value={s.averageScore} tone={scoreTone(s.averageScore) === 'error' ? 'error' : 'primary'} width={48} /> },
                    { label: 'Submissions', value: s.submissions ?? 0 },
                    { label: 'Last activity', value: s.lastActivityAt ? formatRelative(s.lastActivityAt) : 'None' },
                    { label: 'Enrolled', value: formatDate(s.enrolledAt) },
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
          <>
            <TableContainer>
              <Table sx={{ minWidth: 680 }} aria-label="Course roster">
                <TableHead>
                  <TableRow>
                    {header('name', 'Student')}
                    {header('averageScore', 'Average')}
                    {header('submissions', 'Submissions', 'right')}
                    {header('lastActivityAt', 'Last activity')}
                    {header('enrolledAt', 'Enrolled')}
                    <TableCell align="right" width={56}>
                      <Box component="span" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
                        Actions
                      </Box>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE).map((s) => (
                    <TableRow key={s.id} hover>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
                          <Avatar
                            sx={(t) => ({
                              width: 32,
                              height: 32,
                              fontSize: 13,
                              fontWeight: 700,
                              bgcolor: alpha(t.palette.primary.main, 0.12),
                              color: t.palette.mode === 'dark' ? 'primary.light' : 'primary.dark',
                            })}
                          >
                            {initials(s.name)}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {s.name}
                              {s.deactivated && (
                                <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 1 }}>
                                  (deactivated)
                                </Typography>
                              )}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="p">
                              {s.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <ScoreBar value={s.averageScore} tone={scoreTone(s.averageScore) === 'error' ? 'error' : 'primary'} width={64} />
                      </TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                        {s.submissions ?? 0}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: s.lastActivityAt ? 'text.primary' : 'text.secondary' }}>
                          {s.lastActivityAt ? formatRelative(s.lastActivityAt) : 'No activity'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                          {formatDate(s.enrolledAt)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Tooltip title="Remove from course">
                          <IconButton size="small" aria-label={`Remove ${s.name} from the course`} onClick={() => setRemoving(s)}>
                            <PersonRemoveOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
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
          </>
        )}
      </SectionCard>

      <CoInstructors course={course} patchCourse={patchCourse} />

      <ConfirmDialog
        open={!!removing}
        title="Remove student?"
        description={`${removing?.name} will lose access to this course and its assessments. Their past submissions are kept, and they can't rejoin with the code unless you add them back.`}
        confirmLabel="Remove student"
        tone="error"
        onConfirm={remove}
        onClose={() => setRemoving(null)}
      />
    </Box>
  );
}
