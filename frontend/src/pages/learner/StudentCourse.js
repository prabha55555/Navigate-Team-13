import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Box, Button, Container, Paper, Skeleton, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { listAssessments } from '../../api/assessments';
import { getCourse } from '../../api/courses';
import dedupe from '../../components/learner/dedupe';
import { EmptyState, useAsync } from '../../components/common';
import { usePageTitle } from '../../components/layout/breadcrumb';
import { REASON_COPY, formatDateTime, formatPercent, pluralize, scoreTone } from '../../components/learner/format';
import { ErrorState, Section, TimeLeftChip, ToneChip, safeAlpha } from '../../components/learner/ui';

const loadCourse = (courseId) => dedupe(`course:${courseId}`, async () => {
  const [course, assessments] = await Promise.all([getCourse(courseId), listAssessments({ courseId, pageSize: 100 })]);
  return { course, assessments: assessments?.items || [] };
});

const groupOf = (a) => {
  const s = a.myStatus || {};
  if (s.inProgressSubmissionId || s.reason === 'in-progress') return 'open';
  if (a.status === 'published' && s.canStart) return 'open';
  if (s.reason === 'not-yet-available') return 'upcoming';
  if ((s.attempts || 0) > 0) return 'completed';
  return 'closed';
};

const GROUPS = [
  { key: 'open', title: 'Open now', empty: 'Nothing to take right now.' },
  { key: 'upcoming', title: 'Upcoming' },
  { key: 'completed', title: 'Completed' },
  { key: 'closed', title: 'Closed' },
];

const AssessmentRow = ({ a }) => {
  const theme = useTheme();
  const s = a.myStatus || {};
  const attempts = s.attempts || 0;
  const max = a.maxAttempts || 1;
  const resume = Boolean(s.inProgressSubmissionId) || s.reason === 'in-progress';
  const canStart = s.canStart || resume;
  const group = groupOf(a);
  const proctored = a.proctoring?.enabled && !a.isPractice;
  const best = s.bestPercentage;

  let reasonText = null;
  if (!canStart && s.reason) {
    if (s.reason === 'not-yet-available') reasonText = `Opens ${formatDateTime(a.availableFrom)}`;
    else if (s.reason === 'past-due' && attempts === 0) reasonText = 'Missed — the due date has passed';
    else if (s.reason === 'closed' && attempts === 0) reasonText = 'Closed before you took it';
    else reasonText = REASON_COPY[s.reason]?.short;
  }

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        gap: 2,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: resume ? alpha(theme.palette.info.main, 0.5) : 'divider',
        bgcolor: resume ? alpha(theme.palette.info.main, 0.04) : 'background.paper',
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '1.02rem' }}>{a.title}</Typography>
          {proctored && <ToneChip icon={<ShieldOutlinedIcon />} label="Proctored" />}
          {resume && <ToneChip tone="info" label="In progress" />}
        </Box>
        {a.description && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {a.description}
          </Typography>
        )}
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }}>
          {[
            a.questionCount ? pluralize(a.questionCount, 'question') : null,
            a.timeLimit ? `${a.timeLimit} min` : 'No time limit',
            a.dueDate ? `Due ${formatDateTime(a.dueDate)}` : null,
            `${attempts}/${max} attempt${max === 1 ? '' : 's'} used`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
        {reasonText && (
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <LockOutlinedIcon sx={{ fontSize: 14 }} aria-hidden="true" />
            {reasonText}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', justifyContent: { xs: 'space-between', sm: 'flex-end' }, flex: 'none' }}>
        {attempts > 0 && (
          <Box sx={{ textAlign: 'right', minWidth: 64 }}>
            <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              Best
            </Typography>
            <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: best == null ? 'text.secondary' : `${scoreTone(best, a.passingScore)}.main` }}>
              {best == null ? 'Pending' : formatPercent(best, 1)}
            </Typography>
          </Box>
        )}
        {group === 'open' && !resume && <TimeLeftChip dueDate={a.dueDate} />}
        <Box sx={{ display: 'flex', gap: 1 }}>
          {s.lastSubmissionId && (
            <Button component={RouterLink} to={`/app/results/${s.lastSubmissionId}`} size="small" variant={canStart ? 'text' : 'outlined'}>
              View result
            </Button>
          )}
          {canStart && (
            <Button
              component={RouterLink}
              to={`/app/take/${a.id}`}
              size="small"
              variant="contained"
              startIcon={resume ? <PlayArrowRoundedIcon /> : attempts > 0 ? <ReplayRoundedIcon /> : <PlayArrowRoundedIcon />}
              aria-label={`${resume ? 'Resume' : attempts > 0 ? 'Retake' : 'Start'} ${a.title}`}
            >
              {resume ? 'Resume' : attempts > 0 ? 'Retake' : 'Start'}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
};

const CourseSkeleton = () => (
  <Box aria-busy="true" aria-label="Loading course">
    <Skeleton variant="rounded" height={170} sx={{ borderRadius: 5, mb: 3 }} />
    {[0, 1, 2].map((i) => (
      <Skeleton key={i} variant="rounded" height={96} sx={{ borderRadius: 3, mb: 1.5 }} />
    ))}
  </Box>
);

export default function StudentCourse() {
  const { courseId } = useParams();
  const theme = useTheme();
  const { data, error, loading, reload } = useAsync(() => loadCourse(courseId), [courseId]);

  usePageTitle(data?.course?.title);

  const grouped = useMemo(() => {
    const out = { open: [], upcoming: [], completed: [], closed: [], practice: [] };
    (data?.assessments || []).forEach((a) => {
      if (a.isPractice) out.practice.push(a);
      else out[groupOf(a)].push(a);
    });
    const byDue = (x, y) => (x.dueDate ? new Date(x.dueDate).getTime() : Infinity) - (y.dueDate ? new Date(y.dueDate).getTime() : Infinity);
    out.open.sort(byDue);
    out.upcoming.sort((x, y) => new Date(x.availableFrom || 0) - new Date(y.availableFrom || 0));
    out.completed.sort((x, y) => -byDue(x, y));
    out.closed.sort((x, y) => -byDue(x, y));
    out.practice.sort((x, y) => new Date(y.publishedAt || 0) - new Date(x.publishedAt || 0));
    return out;
  }, [data]);

  if (loading && !data) {
    return (
      <Container maxWidth="lg">
        <CourseSkeleton />
      </Container>
    );
  }

  if (error && !data) {
    const nf = error.status === 404 || error.status === 403;
    return (
      <Container maxWidth="lg">
        <ErrorState
          error={nf ? { message: "This course doesn't exist or you're not enrolled in it." } : error}
          title={nf ? 'Course not found' : "We couldn't load this course"}
          onRetry={nf ? null : reload}
          action={
            nf ? (
              <Button component={RouterLink} to="/app" variant="contained">
                Back to dashboard
              </Button>
            ) : null
          }
        />
      </Container>
    );
  }

  const { course } = data;
  const color = course.color || theme.palette.primary.main;
  const graded = data.assessments.filter((a) => !a.isPractice);
  const pathLink = `/app/courses/${course.id}/learning-path`;

  return (
    <Container maxWidth="lg">
      {/* Course header */}
      <Paper
        variant="outlined"
        component="header"
        sx={{
          borderRadius: 5,
          overflow: 'hidden',
          mb: 3,
          position: 'relative',
          backgroundImage: `linear-gradient(120deg, ${safeAlpha(color, 0.16, theme.palette.primary.main)}, ${safeAlpha(color, 0.02, theme.palette.primary.main)} 60%)`,
        }}
      >
        <Box sx={{ height: 6, bgcolor: color }} aria-hidden="true" />
        <Box sx={{ p: { xs: 2.5, sm: 4 }, display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' }, alignItems: { md: 'flex-end' } }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
              {[course.code, course.term].filter(Boolean).join(' · ') || 'Course'}
            </Typography>
            <Typography variant="h3" component="h1" sx={{ mb: 1 }}>
              {course.title}
            </Typography>
            {course.description && (
              <Typography sx={{ color: 'text.secondary', maxWidth: 720, mb: 1 }}>{course.description}</Typography>
            )}
            {Array.isArray(course.instructors) && course.instructors.length > 0 && (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Taught by {course.instructors.map((i) => i.name).join(', ')}
              </Typography>
            )}
          </Box>
          <Button component={RouterLink} to={pathLink} variant="contained" size="large" startIcon={<RouteRoundedIcon />} sx={{ flex: 'none' }}>
            My learning path
          </Button>
        </Box>
      </Paper>

      {!graded.length ? (
        <EmptyState
          icon={<EventAvailableOutlinedIcon />}
          title="No assessments yet"
          description="Your instructor hasn't published any assessments for this course. You'll get a notification when one opens."
          sx={{ mb: 3 }}
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 3, mb: 3 }}>
          {GROUPS.filter((g) => grouped[g.key].length || g.key === 'open').map((g) => (
            <Section key={g.key} title={`${g.title}${grouped[g.key].length ? ` (${grouped[g.key].length})` : ''}`}>
              {grouped[g.key].length ? (
                <Box component="ul" sx={{ p: 0, m: 0, display: 'grid', gap: 1.5 }}>
                  {grouped[g.key].map((a) => (
                    <AssessmentRow key={a.id} a={a} />
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {g.empty}
                </Typography>
              )}
            </Section>
          ))}
        </Box>
      )}

      <Section
        title="Practice quizzes"
        action={
          <Button component={RouterLink} to={`${pathLink}?practice=1`} size="small" startIcon={<AutoAwesomeOutlinedIcon />}>
            New practice quiz
          </Button>
        }
      >
        {grouped.practice.length ? (
          <Box component="ul" sx={{ p: 0, m: 0, display: 'grid', gap: 1.5 }}>
            {grouped.practice.map((a) => (
              <AssessmentRow key={a.id} a={a} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Practice quizzes are generated for your weakest topics and never count towards your grade. Create one from your learning path.
          </Typography>
        )}
      </Section>
    </Container>
  );
}
