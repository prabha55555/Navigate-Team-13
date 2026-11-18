import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listAssessments } from '../../api/assessments';
import { listCourses } from '../../api/courses';
import { listInvites, listMembers } from '../../api/workspace';
import { isAdminRole, isStaffRole } from '../../auth/roles';
import { useAuth } from '../../contexts/AuthContext';
import { useNotify } from '../../contexts/NotificationContext';
import { copyToClipboard } from './hooks';

const dismissKey = (userId) => `nv-onboarding-dismissed:${userId}`;
const sharedKey = (userId) => `nv-onboarding-shared-code:${userId}`;

const readFlag = (key) => {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (key) => {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* ignore */
  }
};

/**
 * Getting-started checklist for owners, admins and instructors:
 * create a course → share its join code → create an assessment → publish it → invite a colleague (admins).
 * Progress comes from real workspace data; the card hides itself once dismissed or complete.
 */
const OnboardingChecklist = ({ sx }) => {
  const { currentUser } = useAuth();
  const notify = useNotify();
  const navigate = useNavigate();
  const userId = currentUser?.id;
  const isAdmin = isAdminRole(currentUser?.role);
  const [dismissed, setDismissed] = useState(() => (userId ? readFlag(dismissKey(userId)) : false));
  const [sharedCode, setSharedCode] = useState(() => (userId ? readFlag(sharedKey(userId)) : false));
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isStaffRole(currentUser?.role) || dismissed) return undefined;
    let cancelled = false;
    Promise.all([
      listCourses({ pageSize: 50 }),
      listAssessments({ pageSize: 1 }),
      listAssessments({ status: 'published', pageSize: 1 }),
      listAssessments({ status: 'closed', pageSize: 1 }),
      isAdmin ? listInvites({ pageSize: 1 }) : Promise.resolve(null),
      isAdmin ? listMembers({ pageSize: 1, role: 'instructor' }) : Promise.resolve(null),
      isAdmin ? listMembers({ pageSize: 1, role: 'admin' }) : Promise.resolve(null),
    ])
      .then(([courses, all, published, closed, invites, instructors, admins]) => {
        if (cancelled) return;
        const items = courses?.items || [];
        setData({
          firstCourse: items[0] || null,
          courseCount: courses?.total ?? items.length,
          studentsJoined: items.some((c) => (c.studentCount || 0) > 0),
          assessmentCount: all?.total || 0,
          publishedCount: (published?.total || 0) + (closed?.total || 0),
          invited: Boolean(invites?.total) || (instructors?.total || 0) + (admins?.total || 0) > 0,
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [currentUser?.role, dismissed, isAdmin]);

  const shareCode = useCallback(async () => {
    const course = data?.firstCourse;
    if (!course?.joinCode) {
      navigate(course ? `/app/courses/${course.id}/students` : '/app/courses');
      return;
    }
    const ok = await copyToClipboard(`${window.location.origin}/join/${course.joinCode}`);
    notify(ok ? `Join link for ${course.title} copied — share it with your students` : `Join code: ${course.joinCode}`, ok ? 'success' : 'info');
    writeFlag(sharedKey(userId));
    setSharedCode(true);
  }, [data, navigate, notify, userId]);

  const steps = useMemo(() => {
    if (!data) return [];
    const course = data.firstCourse;
    const list = [
      {
        key: 'course',
        label: 'Create your first course',
        hint: 'Courses hold your students, assessments and gradebook.',
        done: data.courseCount > 0,
        action: { label: 'Create course', onClick: () => navigate('/app/courses?new=1') },
      },
      {
        key: 'share',
        label: 'Share the join code with students',
        hint: 'Students enter the code (or open the link) to enrol themselves.',
        done: data.studentsJoined || sharedCode,
        action: { label: course?.joinCode ? 'Copy join link' : 'Open roster', onClick: shareCode, disabled: !course },
      },
      {
        key: 'assessment',
        label: 'Create an assessment',
        hint: 'Write questions yourself, pull from the bank, or generate them with AI.',
        done: data.assessmentCount > 0,
        action: {
          label: 'New assessment',
          onClick: () => navigate(course ? `/app/assessments/new?courseId=${course.id}` : '/app/assessments/new'),
          disabled: !course,
        },
      },
      {
        key: 'publish',
        label: 'Publish it to your class',
        hint: 'Enrolled students are notified and can start right away.',
        done: data.publishedCount > 0,
        action: { label: 'Go to courses', onClick: () => navigate(course ? `/app/courses/${course.id}/assessments` : '/app/courses'), disabled: !data.assessmentCount },
      },
    ];
    if (isAdmin) {
      list.push({
        key: 'invite',
        label: 'Invite a colleague',
        hint: 'Add instructors or admins with an invite link.',
        done: data.invited,
        action: { label: 'Invite', onClick: () => navigate('/app/settings/members') },
      });
    }
    return list;
  }, [data, isAdmin, navigate, shareCode, sharedCode]);

  const doneCount = steps.filter((s) => s.done).length;
  const complete = steps.length > 0 && doneCount === steps.length;

  if (!isStaffRole(currentUser?.role) || dismissed || failed || complete) return null;

  const dismiss = () => {
    writeFlag(dismissKey(userId));
    setDismissed(true);
  };

  const nextKey = steps.find((s) => !s.done)?.key;

  return (
    <Paper variant="outlined" component="section" aria-labelledby="nv-onboarding-title" sx={{ p: { xs: 2, sm: 2.5 }, borderRadius: 4, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
            Getting started
          </Typography>
          <Typography id="nv-onboarding-title" variant="h6" component="h2">
            Set up your workspace
          </Typography>
          {data ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1 }}>
              <LinearProgress
                variant="determinate"
                value={(doneCount / steps.length) * 100}
                sx={{ flex: 1, maxWidth: 240 }}
                aria-label={`${doneCount} of ${steps.length} steps done`}
              />
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {doneCount} of {steps.length} done
              </Typography>
            </Box>
          ) : (
            <Skeleton width={200} height={20} />
          )}
        </Box>
        <Tooltip title="Hide checklist">
          <IconButton aria-label="Hide getting-started checklist" onClick={dismiss} size="small">
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Stack component="ol" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {!data &&
          [0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={52} />)}
        {steps.map((step) => {
          const isNext = step.key === nextKey;
          return (
            <Box
              component="li"
              key={step.key}
              sx={(t) => ({
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                p: 1.25,
                borderRadius: 2.5,
                bgcolor: isNext ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.12 : 0.05) : 'transparent',
              })}
            >
              {step.done ? (
                <CheckCircleRoundedIcon sx={{ color: 'success.main' }} aria-label="Done" />
              ) : (
                <RadioButtonUncheckedRoundedIcon sx={{ color: 'text.disabled' }} aria-label="Not done" />
              )}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  variant="body2"
                  sx={{ fontWeight: 600, color: step.done ? 'text.secondary' : 'text.primary', textDecoration: step.done ? 'line-through' : 'none' }}
                >
                  {step.label}
                </Typography>
                {isNext && (
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                    {step.hint}
                  </Typography>
                )}
              </Box>
              {!step.done && (
                <Button
                  size="small"
                  variant={isNext ? 'contained' : 'text'}
                  onClick={step.action.onClick}
                  disabled={step.action.disabled}
                  sx={{ flex: 'none' }}
                >
                  {step.action.label}
                </Button>
              )}
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
};

export default OnboardingChecklist;
