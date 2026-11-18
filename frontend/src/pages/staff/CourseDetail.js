import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import ToggleOffOutlinedIcon from '@mui/icons-material/ToggleOffOutlined';
import ToggleOnOutlinedIcon from '@mui/icons-material/ToggleOnOutlined';
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import React, { Suspense, lazy, useState } from 'react';
import { Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { getCourseAnalytics } from '../../api/analytics';
import { getCourse, regenerateJoinCode, updateCourse } from '../../api/courses';
import { EmptyState } from '../../components/common';
import ConfirmDialog from '../../components/staff/ConfirmDialog';
import CourseFormDialog from '../../components/staff/CourseFormDialog';
import InviteStudentsDialog from '../../components/staff/InviteStudentsDialog';
import JoinCodeChip from '../../components/staff/JoinCodeChip';
import { ErrorState, TableSkeleton, useIsMobile } from '../../components/staff/StaffUI';
import { useBreadcrumb } from '../../components/layout/breadcrumb';
import { copyText } from '../../components/staff/staffUtils';
import useApiData from '../../components/staff/useApiData';
import usePlanError from '../../components/staff/usePlanError';
import { useNotify } from '../../contexts/NotificationContext';

const CourseOverviewTab = lazy(() => import('../../components/staff/course/CourseOverviewTab'));
const CourseAssessmentsTab = lazy(() => import('../../components/staff/course/CourseAssessmentsTab'));
const CourseStudentsTab = lazy(() => import('../../components/staff/course/CourseStudentsTab'));
const CourseGradebookTab = lazy(() => import('../../components/staff/course/CourseGradebookTab'));
const CourseAnalyticsTab = lazy(() => import('../../components/staff/course/CourseAnalyticsTab'));
const CourseCurriculumTab = lazy(() => import('../../components/staff/course/CourseCurriculumTab'));

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'assessments', label: 'Assessments' },
  { value: 'students', label: 'Students' },
  { value: 'gradebook', label: 'Gradebook' },
  { value: 'analytics', label: 'Analytics' },
  { value: 'curriculum', label: 'Curriculum' },
];

function HeaderSkeleton() {
  return (
    <Box sx={{ mb: 3 }}>
      <Skeleton width={120} />
      <Skeleton width="50%" height={48} />
      <Skeleton width="30%" />
    </Box>
  );
}

export default function CourseDetail() {
  const { courseId, tab = 'overview' } = useParams();
  const notify = useNotify();
  const handleError = usePlanError();
  const course = useApiData(() => getCourse(courseId), [courseId]);
  const analytics = useApiData(() => getCourseAnalytics(courseId), [courseId]);
  useBreadcrumb(course.data?.title, { label: 'Courses', to: '/app/courses' });
  const isMobile = useIsMobile();
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [invite, setInvite] = useState({ open: false, tab: 'share' });
  const [confirmRegen, setConfirmRegen] = useState(false);

  if (!TABS.some((t) => t.value === tab)) return <Navigate to={`/app/courses/${courseId}`} replace />;

  const c = course.data;
  if (course.error) {
    if (course.error.status === 404) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title="Course not found"
          description="It may have been removed, or you don’t teach it."
          action={
            <Button component={RouterLink} to="/app/courses" variant="contained">
              Back to courses
            </Button>
          }
        />
      );
    }
    return <ErrorState error={course.error} onRetry={course.reload} title="We couldn’t load this course" backTo="/app/courses" backLabel="Back to courses" />;
  }

  const patchCourse = (patch) => course.setData((prev) => ({ ...prev, ...patch }));

  const toggleJoinCode = async () => {
    setMenuAnchor(null);
    try {
      const next = await updateCourse(c.id, { joinCodeEnabled: !c.joinCodeEnabled });
      patchCourse({ joinCodeEnabled: next.joinCodeEnabled ?? !c.joinCodeEnabled });
      notify(c.joinCodeEnabled ? 'Join code turned off — students can no longer use it' : 'Join code turned on', 'success');
    } catch (err) {
      handleError(err, 'Could not change the join code');
    }
  };

  const regenerate = async () => {
    try {
      const { joinCode } = await regenerateJoinCode(c.id);
      patchCourse({ joinCode });
      notify(`New join code: ${joinCode}`, 'success');
      setConfirmRegen(false);
    } catch (err) {
      handleError(err, 'Could not generate a new code');
    }
  };

  const tabProps = { course: c, courseId, analytics, reloadCourse: () => course.reload({ silent: true }), patchCourse };

  return (
    <Box>
      {course.loading || !c ? (
        <HeaderSkeleton />
      ) : (
        <Box
          component="header"
          sx={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 2,
            alignItems: { xs: 'flex-start', md: 'flex-end' },
            justifyContent: 'space-between',
            mb: 2.5,
          }}
        >
          <Box sx={{ minWidth: 0, flex: '1 1 360px', display: 'flex', gap: 2 }}>
            <Box aria-hidden="true" sx={{ width: 6, borderRadius: 3, bgcolor: c.color || 'primary.main', flex: 'none', alignSelf: 'stretch' }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
                {[c.code, c.term].filter(Boolean).join(' · ')}
                {c.archived ? ' · Archived' : ''}
              </Typography>
              <Typography variant="h3" component="h1" sx={{ wordBreak: 'break-word', fontSize: { xs: '1.5rem', sm: undefined } }}>
                {c.title}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                  {(c.instructors || []).map((i) => i.name).join(', ')} ·{' '}
                </Box>
                {c.studentCount ?? 0} students · {c.assessmentCount ?? 0} assessments
              </Typography>
            </Box>
            {isMobile && (
              <Box sx={{ display: 'flex', gap: 0.5, flex: 'none', ml: 'auto', alignSelf: 'flex-start' }}>
                <Tooltip title="Invite students">
                  <IconButton
                    aria-label="Invite students"
                    onClick={() => setInvite({ open: true, tab: 'share' })}
                    sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}
                  >
                    <PersonAddAlt1OutlinedIcon />
                  </IconButton>
                </Tooltip>
                <IconButton aria-label="Course options" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider' }}>
                  <MoreHorizRoundedIcon />
                </IconButton>
              </Box>
            )}
          </Box>
          <Box sx={{ display: { xs: 'none', sm: 'flex' }, gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            {c.joinCode && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, mr: 0.5 }}>
                  Join code
                </Typography>
                <JoinCodeChip code={c.joinCode} enabled={c.joinCodeEnabled} />
                <Tooltip title="Join code options">
                  <IconButton size="small" aria-label="Join code options" onClick={(e) => setMenuAnchor(e.currentTarget)}>
                    <MoreHorizRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
            <Button variant="outlined" color="inherit" startIcon={<EditOutlinedIcon />} onClick={() => setEditOpen(true)}>
              Edit
            </Button>
            <Button variant="contained" startIcon={<PersonAddAlt1OutlinedIcon />} onClick={() => setInvite({ open: true, tab: 'share' })}>
              Invite students
            </Button>
          </Box>
        </Box>
      )}

      <Tabs
        value={tab}
        variant="scrollable"
        scrollButtons={isMobile ? 'auto' : false}
        allowScrollButtonsMobile
        aria-label="Course sections"
        sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
      >
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            component={RouterLink}
            to={t.value === 'overview' ? `/app/courses/${courseId}` : `/app/courses/${courseId}/${t.value}`}
          />
        ))}
      </Tabs>

      {!c ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
          {tab === 'overview' && <CourseOverviewTab {...tabProps} onInvite={() => setInvite({ open: true, tab: 'share' })} />}
          {tab === 'assessments' && <CourseAssessmentsTab {...tabProps} />}
          {tab === 'students' && <CourseStudentsTab {...tabProps} onInvite={(t) => setInvite({ open: true, tab: t || 'email' })} />}
          {tab === 'gradebook' && <CourseGradebookTab {...tabProps} />}
          {tab === 'analytics' && <CourseAnalyticsTab {...tabProps} />}
          {tab === 'curriculum' && <CourseCurriculumTab {...tabProps} />}
        </Suspense>
      )}

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {isMobile && c?.joinCode && (
          <MenuItem
            onClick={async () => {
              setMenuAnchor(null);
              const ok = await copyText(c.joinCode);
              notify(ok ? `Join code ${c.joinCode} copied` : 'Could not copy the code', ok ? 'success' : 'warning');
            }}
          >
            <ListItemIcon>
              <ContentCopyRoundedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={`Copy join code ${c.joinCode}`} secondary={c.joinCodeEnabled ? 'Students enter it to join' : 'Currently turned off'} />
          </MenuItem>
        )}
        {isMobile && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setEditOpen(true);
            }}
          >
            <ListItemIcon>
              <EditOutlinedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Edit course details" />
          </MenuItem>
        )}
        <MenuItem onClick={toggleJoinCode}>
          <ListItemIcon>{c?.joinCodeEnabled ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />}</ListItemIcon>
          <ListItemText
            primary={c?.joinCodeEnabled ? 'Turn off join code' : 'Turn on join code'}
            secondary={c?.joinCodeEnabled ? 'Stop new students joining by code' : 'Let students join with the code'}
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setConfirmRegen(true);
          }}
        >
          <ListItemIcon>
            <AutorenewRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Generate a new code" secondary="The current code stops working" />
        </MenuItem>
      </Menu>

      <CourseFormDialog
        open={editOpen}
        course={c}
        onClose={() => setEditOpen(false)}
        onSaved={(saved) => {
          setEditOpen(false);
          patchCourse(saved);
        }}
      />
      <InviteStudentsDialog
        open={invite.open}
        initialTab={invite.tab}
        course={c}
        onClose={() => setInvite((s) => ({ ...s, open: false }))}
        onAdded={() => {
          course.reload({ silent: true });
          analytics.reload({ silent: true });
        }}
      />
      <ConfirmDialog
        open={confirmRegen}
        title="Generate a new join code?"
        description={`The current code ${c?.joinCode || ''} will stop working immediately. Students already enrolled are not affected.`}
        confirmLabel="Generate new code"
        tone="warning"
        onConfirm={regenerate}
        onClose={() => setConfirmRegen(false)}
      />
    </Box>
  );
}
