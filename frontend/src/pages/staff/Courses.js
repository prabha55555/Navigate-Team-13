import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  FormControlLabel,
  IconButton,
  InputAdornment,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { listCourses, updateCourse } from '../../api/courses';
import { EmptyState, PageHeader } from '../../components/common';
import ConfirmDialog from '../../components/staff/ConfirmDialog';
import CourseFormDialog from '../../components/staff/CourseFormDialog';
import JoinCodeChip from '../../components/staff/JoinCodeChip';
import { ErrorState } from '../../components/staff/StaffUI';
import { pluralize } from '../../components/staff/staffUtils';
import useApiData, { useDebouncedValue } from '../../components/staff/useApiData';
import usePlanError from '../../components/staff/usePlanError';
import { useNotify } from '../../contexts/NotificationContext';

const gridSx = {
  display: 'grid',
  gap: 2.5,
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' },
};

function CourseCard({ course, onEdit, onArchive }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <Card
      variant="outlined"
      sx={(t) => ({
        position: 'relative',
        borderRadius: 4,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow .2s ease, transform .2s ease',
        '&:hover': { boxShadow: t.shadows[8], transform: 'translateY(-2px)' },
        '&::before': {
          content: '""',
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          height: 6,
          bgcolor: course.color || 'primary.main',
        },
      })}
    >
      <CardActionArea
        component={RouterLink}
        to={`/app/courses/${course.id}`}
        sx={{ p: 2.5, pt: 3, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1, pr: 4 }}>
          <Typography
            variant="caption"
            sx={(t) => ({
              fontWeight: 700,
              letterSpacing: '0.04em',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              bgcolor: alpha(course.color || t.palette.primary.main, 0.14),
              color: 'text.primary',
            })}
          >
            {course.code}
          </Typography>
          {course.term && (
            <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
              {course.term}
            </Typography>
          )}
          {course.archived && (
            <Typography variant="caption" sx={{ color: 'warning.main', fontWeight: 700 }}>
              Archived
            </Typography>
          )}
        </Box>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 700, lineHeight: 1.3, mb: 0.75 }}>
          {course.title}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            color: 'text.secondary',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.86em',
          }}
        >
          {course.description || 'No description yet.'}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', gap: 2, mt: 2, color: 'text.secondary', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <GroupsOutlinedIcon sx={{ fontSize: 18 }} aria-hidden="true" />
            <Typography variant="body2">{pluralize(course.studentCount || 0, 'student')}</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AssignmentOutlinedIcon sx={{ fontSize: 18 }} aria-hidden="true" />
            <Typography variant="body2">{pluralize(course.assessmentCount || 0, 'assessment')}</Typography>
          </Box>
        </Box>
      </CardActionArea>
      <Box
        sx={{
          px: 2.5,
          py: 1.25,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          minHeight: 48,
        }}
      >
        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
          {(course.instructors || []).map((i) => i.name).join(', ')}
        </Typography>
        <JoinCodeChip code={course.joinCode} enabled={course.joinCodeEnabled} />
      </Box>
      <IconButton
        aria-label={`Actions for ${course.title}`}
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ position: 'absolute', top: 14, right: 10 }}
      >
        <MoreVertRoundedIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onEdit(course);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit details</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAnchor(null);
            onArchive(course);
          }}
        >
          <ListItemIcon>{course.archived ? <UnarchiveOutlinedIcon fontSize="small" /> : <ArchiveOutlinedIcon fontSize="small" />}</ListItemIcon>
          <ListItemText>{course.archived ? 'Restore' : 'Archive'}</ListItemText>
        </MenuItem>
      </Menu>
    </Card>
  );
}

function CardSkeleton() {
  return (
    <Card variant="outlined" sx={{ borderRadius: 4, p: 2.5 }}>
      <Skeleton width={90} height={22} />
      <Skeleton width="80%" height={32} />
      <Skeleton width="100%" />
      <Skeleton width="70%" />
      <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
        <Skeleton width={90} />
        <Skeleton width={110} />
      </Box>
    </Card>
  );
}

export default function Courses() {
  const navigate = useNavigate();
  const notify = useNotify();
  const handleError = usePlanError();
  const [query, setQuery] = useState('');
  const [archived, setArchived] = useState(false);
  const q = useDebouncedValue(query.trim(), 300);
  const { data, error, loading, reload } = useApiData(
    () => listCourses({ q: q || undefined, archived: archived ? 'true' : undefined, pageSize: 100 }),
    [q, archived]
  );
  const [dialog, setDialog] = useState({ open: false, course: null });
  const [params, setParams] = useSearchParams();

  // /app/courses?new=1 (command palette, onboarding) opens the create dialog once.
  useEffect(() => {
    if (params.get('new') !== '1') return;
    setDialog({ open: true, course: null });
    const next = new URLSearchParams(params);
    next.delete('new');
    setParams(next, { replace: true });
  }, [params, setParams]);
  const [archiveTarget, setArchiveTarget] = useState(null);

  const courses = data?.items || [];

  const toggleArchive = async () => {
    const c = archiveTarget;
    try {
      await updateCourse(c.id, { archived: !c.archived });
      notify(c.archived ? `Restored “${c.title}”` : `Archived “${c.title}”`, 'success');
      setArchiveTarget(null);
      reload({ silent: true });
    } catch (err) {
      handleError(err, 'Could not update the course');
    }
  };

  return (
    <Box>
      <PageHeader
        title="Courses"
        description="Your classes, their students and join codes."
        actions={
          <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({ open: true, course: null })}>
            New course
          </Button>
        }
      >
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search by title or code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            inputProps={{ 'aria-label': 'Search courses' }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchRoundedIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{ width: { xs: '100%', sm: 320 } }}
          />
          <FormControlLabel
            control={<Switch checked={archived} onChange={(e) => setArchived(e.target.checked)} />}
            label="Show archived"
          />
          {!loading && data && (
            <Typography variant="body2" sx={{ color: 'text.secondary', ml: { sm: 'auto' } }}>
              {pluralize(data.total ?? courses.length, archived ? 'archived course' : 'course')}
            </Typography>
          )}
        </Box>
      </PageHeader>

      {error ? (
        <ErrorState error={error} onRetry={reload} title="We couldn’t load your courses" />
      ) : loading ? (
        <Box sx={gridSx}>
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </Box>
      ) : courses.length === 0 ? (
        q ? (
          <EmptyState
            icon={<SearchRoundedIcon />}
            title="No matching courses"
            description={`Nothing matches “${q}”. Try a different title or code.`}
            action={<Button onClick={() => setQuery('')}>Clear search</Button>}
          />
        ) : archived ? (
          <EmptyState icon={<ArchiveOutlinedIcon />} title="No archived courses" description="Courses you archive are kept here with all their history." />
        ) : (
          <EmptyState
            icon={<LibraryBooksOutlinedIcon />}
            title="Create your first course"
            description="A course holds students, assessments and analytics. Students join with a short code you share."
            action={
              <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setDialog({ open: true, course: null })}>
                New course
              </Button>
            }
          />
        )
      ) : (
        <Box sx={gridSx}>
          {courses.map((c) => (
            <CourseCard key={c.id} course={c} onEdit={(course) => setDialog({ open: true, course })} onArchive={setArchiveTarget} />
          ))}
        </Box>
      )}

      <CourseFormDialog
        open={dialog.open}
        course={dialog.course}
        onClose={() => setDialog({ open: false, course: null })}
        onSaved={(saved) => {
          const wasNew = !dialog.course;
          setDialog({ open: false, course: null });
          if (wasNew) navigate(`/app/courses/${saved.id}`);
          else reload({ silent: true });
        }}
      />
      <ConfirmDialog
        open={!!archiveTarget}
        title={archiveTarget?.archived ? 'Restore course?' : 'Archive course?'}
        description={
          archiveTarget?.archived
            ? 'The course will appear in your active list again.'
            : 'Archived courses are hidden from students and your active list. All submissions and grades are kept, and you can restore it at any time.'
        }
        confirmLabel={archiveTarget?.archived ? 'Restore' : 'Archive'}
        tone={archiveTarget?.archived ? 'primary' : 'warning'}
        onConfirm={toggleArchive}
        onClose={() => setArchiveTarget(null)}
      />
    </Box>
  );
}
