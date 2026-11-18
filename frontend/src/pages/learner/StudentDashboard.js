import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LocalFireDepartmentOutlinedIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import { Box, Button, ButtonBase, Container, Skeleton, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import React, { useMemo } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getMyAnalytics } from '../../api/analytics';
import { listAssessments } from '../../api/assessments';
import dedupe from '../../components/learner/dedupe';
import { EmptyState, PageHeader, StatCard, useAsync } from '../../components/common';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate, formatPercent, formatRelative, pluralize, scoreTone } from '../../components/learner/format';
import { CourseDot, ErrorState, Section, TimeLeftChip, ToneBar, ToneChip } from '../../components/learner/ui';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const loadDashboard = () => dedupe('dashboard', async () => {
  const [analytics, assessments] = await Promise.all([
    getMyAnalytics(),
    listAssessments({ practice: false, pageSize: 100 }),
  ]);
  return { analytics, assessments: assessments?.items || [] };
});

const RowLink = ({ to, children, sx }) => (
  <ButtonBase
    component={RouterLink}
    to={to}
    sx={{
      width: '100%',
      display: 'flex',
      justifyContent: 'flex-start',
      textAlign: 'left',
      gap: 1.5,
      px: 1.5,
      py: 1.25,
      mx: -1.5,
      borderRadius: 2.5,
      '&:hover': { bgcolor: 'action.hover' },
      '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main' },
      ...sx,
    }}
  >
    {children}
  </ButtonBase>
);

const UpNextRow = ({ a }) => {
  const s = a.myStatus || {};
  const resume = Boolean(s.inProgress || s.inProgressSubmissionId) || s.reason === 'in-progress';
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        display: 'flex',
        alignItems: { xs: 'flex-start', sm: 'center' },
        flexDirection: { xs: 'column', sm: 'row' },
        gap: { xs: 1, sm: 2 },
        py: 1.75,
        borderTop: '1px solid',
        borderColor: 'divider',
        '&:first-of-type': { borderTop: 0, pt: 0.5 },
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <CourseDot color={a.courseColor} />
          <Typography variant="caption" noWrap sx={{ color: 'text.secondary', fontWeight: 600 }}>
            {a.courseTitle}
          </Typography>
        </Box>
        <Typography sx={{ fontWeight: 600 }} noWrap>
          {a.title}
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {a.questionCount ? pluralize(a.questionCount, 'question') : ''}
          {a.timeLimit ? ` · ${a.timeLimit} min` : ''}
          {a.dueDate ? ` · Due ${formatDate(a.dueDate, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}` : ''}
          {a.maxAttempts > 1 ? ` · Attempt ${Math.min((s.attempts || 0) + 1, a.maxAttempts)} of ${a.maxAttempts}` : ''}
        </Typography>
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 'none' }}>
        {resume ? <ToneChip tone="info" label="In progress" /> : <TimeLeftChip dueDate={a.dueDate} />}
        <Button
          component={RouterLink}
          to={`/app/take/${a.id}`}
          variant={resume ? 'contained' : 'outlined'}
          size="small"
          startIcon={<PlayArrowRoundedIcon />}
          aria-label={`${resume ? 'Resume' : 'Start'} ${a.title}`}
        >
          {resume ? 'Resume' : 'Start'}
        </Button>
      </Box>
    </Box>
  );
};

const DashboardSkeleton = () => (
  <Box aria-busy="true" aria-label="Loading your dashboard">
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2, mb: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rounded" height={104} sx={{ borderRadius: 4 }} />
      ))}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, gap: 3 }}>
      <Skeleton variant="rounded" height={280} sx={{ borderRadius: 4 }} />
      <Skeleton variant="rounded" height={280} sx={{ borderRadius: 4 }} />
      <Skeleton variant="rounded" height={240} sx={{ borderRadius: 4 }} />
      <Skeleton variant="rounded" height={240} sx={{ borderRadius: 4 }} />
    </Box>
  </Box>
);

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const theme = useTheme();
  const { data, error, loading, reload } = useAsync(loadDashboard, []);
  const firstName = (currentUser?.name || '').split(' ')[0];


  const derived = useMemo(() => {
    if (!data) return null;
    const { analytics, assessments } = data;
    const courses = analytics?.courses || [];
    const upNext = assessments
      .filter((a) => a.status === 'published' && (a.myStatus?.canStart || a.myStatus?.inProgress || a.myStatus?.inProgressSubmissionId))
      .sort((x, y) => {
        const xr = x.myStatus?.inProgress || x.myStatus?.inProgressSubmissionId ? 0 : 1;
        const yr = y.myStatus?.inProgress || y.myStatus?.inProgressSubmissionId ? 0 : 1;
        if (xr !== yr) return xr - yr;
        const xd = x.dueDate ? new Date(x.dueDate).getTime() : Infinity;
        const yd = y.dueDate ? new Date(y.dueDate).getTime() : Infinity;
        return xd - yd;
      });
    const mastery = Object.entries(analytics?.topicMastery || {})
      .filter(([, v]) => v != null)
      .map(([topic, value]) => ({ topic, value: Number(value) }));
    // Strongest 3 and the 3 lowest (never overlapping), so the card is useful for strong and struggling students alike.
    const ranked = [...mastery].sort((x, y) => y.value - x.value);
    const strengths = ranked.slice(0, 3);
    const weaknesses = ranked.slice(3).reverse().slice(0, 3);
    const graded = courses.filter((c) => c.averageScore != null);
    const avg = graded.length ? graded.reduce((s, c) => s + Number(c.averageScore), 0) / graded.length : null;
    const completed = courses.reduce((s, c) => s + (Number(c.completed) || 0), 0);
    const total = courses.reduce((s, c) => s + (Number(c.total) || 0), 0);
    // Weak topics link to the learning path of the course that owns them, when we can tell.
    return { courses, upNext, strengths, weaknesses, avg, completed, total, recent: analytics?.recent || [], streak: analytics?.streakDays || 0 };
  }, [data]);

  const header = (
    <PageHeader
      eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
      title={`${greeting()}${firstName ? `, ${firstName}` : ''}`}
      description={
        derived && !derived.courses.length
          ? "Let's get you set up."
          : derived && derived.upNext.length
            ? `You have ${pluralize(derived.upNext.length, 'assessment')} open right now.`
            : 'Here is where you stand across your courses.'
      }
      actions={
        derived && !derived.courses.length ? null : <Button component={RouterLink} to="/app/join" variant="outlined" startIcon={<AddRoundedIcon />}>
          Join a course
        </Button>
      }
    />
  );

  if (loading && !data) {
    return (
      <Container maxWidth="lg">
        {header}
        <DashboardSkeleton />
      </Container>
    );
  }

  if (error && !data) {
    return (
      <Container maxWidth="lg">
        {header}
        <ErrorState error={error} onRetry={reload} title="We couldn't load your dashboard" />
      </Container>
    );
  }

  if (!derived.courses.length) {
    return (
      <Container maxWidth="lg">
        {header}
        <EmptyState
          icon={<SchoolOutlinedIcon />}
          title="Join your first course"
          description="Your instructor will give you a 6-character course code. Enter it to see your assessments, results and personal learning path."
          action={
            <Button component={RouterLink} to="/app/join" variant="contained" startIcon={<AddRoundedIcon />}>
              Join a course
            </Button>
          }
        />
      </Container>
    );
  }

  const { courses, upNext, strengths, weaknesses, avg, completed, total, recent, streak } = derived;

  return (
    <Container maxWidth="lg">
      {header}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1.5, sm: 2 }, mb: 3 }}>
        <StatCard label="Open now" value={upNext.length} icon={<EventAvailableOutlinedIcon />} tone="primary" hint={upNext.length ? 'Assessments to take' : 'All caught up'} />
        <StatCard label="Average" value={formatPercent(avg)} icon={<InsightsOutlinedIcon />} tone={scoreTone(avg) === 'error' ? 'error' : 'success'} hint="Best attempts" />
        <StatCard label="Completed" value={`${completed}/${total}`} icon={<AssignmentTurnedInOutlinedIcon />} tone="info" hint="Graded assessments" />
        <StatCard
          label="Streak"
          value={pluralize(streak, 'day')}
          icon={<LocalFireDepartmentOutlinedIcon />}
          tone="secondary"
          hint={streak ? 'Keep it going' : 'Practise today to start one'}
        />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: 'minmax(0, 3fr) minmax(0, 2fr)' }, gap: 3, alignItems: 'start' }}>
        <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <Section title="Up next">
            {upNext.length ? (
              <Box component="ul" sx={{ p: 0, m: 0 }}>
                {upNext.slice(0, 6).map((a) => (
                  <UpNextRow key={a.id} a={a} />
                ))}
              </Box>
            ) : (
              <EmptyState compact icon={<EventAvailableOutlinedIcon />} title="You're all caught up" description="New assessments appear here as soon as your instructors publish them." />
            )}
          </Section>
          <Section
            title="My courses"
            action={
              <Button component={RouterLink} to="/app/join" size="small" startIcon={<AddRoundedIcon />}>
                Join
              </Button>
            }
          >
            <Box component="ul" sx={{ p: 0, m: 0 }}>
              {courses.map((c) => {
                const progress = c.total ? (c.completed / c.total) * 100 : 0;
                return (
                  <Box component="li" key={c.id} sx={{ listStyle: 'none' }}>
                    <RowLink to={`/app/courses/${c.id}`}>
                      <Box
                        aria-hidden="true"
                        sx={{ width: 40, height: 40, borderRadius: 2.5, flex: 'none', display: 'grid', placeItems: 'center', bgcolor: c.color || 'primary.main', color: 'common.white' }}
                      >
                        <MenuBookOutlinedIcon fontSize="small" />
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                          <Typography sx={{ fontWeight: 600 }} noWrap>
                            {c.title}
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', flex: 'none', color: c.averageScore == null ? 'text.secondary' : `${scoreTone(c.averageScore)}.main` }}>
                            {c.averageScore == null ? 'No grades yet' : formatPercent(c.averageScore)}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 0.75 }}>
                          <Box sx={{ flex: 1 }}>
                            <ToneBar value={progress} height={6} label={`${c.title} progress`} />
                          </Box>
                          <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                            {c.completed}/{c.total} done
                          </Typography>
                        </Box>
                      </Box>
                    </RowLink>
                  </Box>
                );
              })}
            </Box>
          </Section>
        </Box>
        <Box sx={{ display: 'grid', gap: 3, minWidth: 0 }}>
          <Section title="Topics" action={<ToneChip label="From graded work" />}>
            {strengths.length || weaknesses.length ? (
              <Box sx={{ display: 'grid', gap: 2.5 }}>
                {[
                  {
                    title: 'Focus next',
                    hint: weaknesses.length && weaknesses.every((m) => m.value >= 80) ? 'All mastered · keep sharp' : 'Lowest mastery',
                    items: weaknesses,
                    empty: 'Focus areas appear once more topics are graded.',
                  },
                  { title: 'Strongest', hint: 'Highest mastery', items: strengths, empty: '' },
                ].map((group) => (
                  <Box key={group.title}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                      <Typography variant="overline" component="h3" noWrap sx={{ color: 'text.secondary', flex: 'none' }}>
                        {group.title}
                      </Typography>
                      {group.items.length > 0 && (
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap>
                          {group.hint}
                        </Typography>
                      )}
                    </Box>
                    {group.items.length ? (
                      <Box component="ul" sx={{ p: 0, m: 0, display: 'grid', gap: 1.5 }}>
                        {group.items.map((m) => (
                          <Box component="li" key={m.topic} sx={{ listStyle: 'none' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {m.topic}
                              </Typography>
                              <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
                                {formatPercent(m.value)}
                              </Typography>
                            </Box>
                            <ToneBar value={m.value} tone={m.value >= 80 ? 'success' : m.value >= 50 ? 'warning' : 'error'} height={6} label={`${m.topic} mastery`} />
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {group.empty}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            ) : (
              <EmptyState
                compact
                icon={<InsightsOutlinedIcon />}
                title="No topics assessed yet"
                description="Your strongest topics and focus areas appear once your first results are released."
              />
            )}
          </Section>
          <Section
            title="Recent results"
            action={
              <Button component={RouterLink} to="/app/results" size="small" endIcon={<ArrowForwardRoundedIcon />}>
                All results
              </Button>
            }
          >
            {recent.length ? (
              <Box component="ul" sx={{ p: 0, m: 0 }}>
                {recent.slice(0, 5).map((r) => (
                  <Box component="li" key={r.id} sx={{ listStyle: 'none' }}>
                    <RowLink to={`/app/results/${r.id}`}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 600 }} noWrap>
                          {r.assessment?.title}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }} noWrap component="p">
                          {r.course?.title} · {formatRelative(r.submittedAt)}
                        </Typography>
                      </Box>
                      {r.released && r.percentage != null ? (
                        <Typography
                          sx={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            flex: 'none',
                            color: theme.palette.mode === 'dark' ? `${scoreTone(r.percentage)}.light` : `${scoreTone(r.percentage)}.dark`,
                          }}
                        >
                          {formatPercent(r.percentage)}
                        </Typography>
                      ) : (
                        <ToneChip label="Awaiting release" sx={{ flex: 'none' }} />
                      )}
                    </RowLink>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Your results will show up here after your first submission.
              </Typography>
            )}
          </Section>
        </Box>
      </Box>
    </Container>
  );
}
