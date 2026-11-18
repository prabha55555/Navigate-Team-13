import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import {
  Avatar,
  Box,
  Button,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Skeleton,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { Bar, Line } from 'react-chartjs-2';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { getOverview } from '../../api/analytics';
import { EmptyState, OnboardingChecklist, PageHeader, StatCard } from '../../components/common';
import { barDataset, lineDataset, useChartTheme } from '../../components/staff/charts';
import CourseFormDialog from '../../components/staff/CourseFormDialog';
import { ErrorState, SectionCard, ToneChip } from '../../components/staff/StaffUI';
import {
  AT_RISK_REASONS,
  firstName,
  formatPercent,
  formatRelative,
  formatShortDate,
  initials,
  scoreTone,
} from '../../components/staff/staffUtils';
import useApiData from '../../components/staff/useApiData';
import { useAuth } from '../../contexts/AuthContext';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
};

const todayLabel = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

function TrendCharts({ trend, loading }) {
  const { base, colors } = useChartTheme();
  const labels = useMemo(() => (trend || []).map((t) => formatShortDate(`${t.week}T00:00:00`)), [trend]);

  const subsData = useMemo(
    () => ({
      labels,
      datasets: [
        barDataset(colors, {
          label: 'Submissions',
          data: (trend || []).map((t) => t.submissions),
          backgroundColor: colors.primarySoft,
          hoverBackgroundColor: colors.primary,
        }),
      ],
    }),
    [labels, trend, colors],
  );
  const scoreData = useMemo(
    () => ({
      labels,
      datasets: [
        lineDataset(colors, colors.success, {
          label: 'Average score',
          data: (trend || []).map((t) => t.averageScore),
          fill: 'origin',
          backgroundColor: colors.area,
          pointBackgroundColor: colors.success,
        }),
      ],
    }),
    [labels, trend, colors],
  );
  const scoreOptions = useMemo(
    () => ({
      ...base,
      scales: {
        ...base.scales,
        y: {
          ...base.scales.y,
          max: 100,
          ticks: { ...base.scales.y.ticks, callback: (v) => `${v}%` },
        },
      },
      plugins: {
        ...base.plugins,
        tooltip: {
          ...base.plugins.tooltip,
          callbacks: {
            label: (ctx) => ` Average score: ${ctx.parsed.y === null ? '—' : `${ctx.parsed.y}%`}`,
          },
        },
      },
    }),
    [base],
  );

  const empty = !loading && (trend || []).every((t) => !t.submissions);

  return (
    <Box
      sx={{
        display: 'grid',
        gap: 3,
        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
      }}
    >
      {[
        {
          key: 'subs',
          title: 'Submissions per week',
          chart: <Bar data={subsData} options={base} aria-hidden="true" />,
        },
        {
          key: 'score',
          title: 'Average score per week',
          chart: <Line data={scoreData} options={scoreOptions} aria-hidden="true" />,
        },
      ].map((c) => (
        <Box key={c.key} sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600, mb: 1 }}>
            {c.title}
          </Typography>
          <Box sx={{ height: 200, position: 'relative' }}>
            {loading ? (
              <Skeleton variant="rounded" height="100%" />
            ) : empty ? (
              <Box
                sx={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'text.secondary',
                }}
              >
                <Typography variant="body2">No submissions in the last 8 weeks</Typography>
              </Box>
            ) : (
              c.chart
            )}
          </Box>
        </Box>
      ))}
      {!loading && !empty && (
        <Box sx={visuallyHidden}>
          <table>
            <caption>Weekly submissions and average score, last 8 weeks</caption>
            <thead>
              <tr>
                <th>Week of</th>
                <th>Submissions</th>
                <th>Average score</th>
              </tr>
            </thead>
            <tbody>
              {(trend || []).map((t) => (
                <tr key={t.week}>
                  <td>{t.week}</td>
                  <td>{t.submissions}</td>
                  <td>{t.averageScore === null ? 'none' : `${t.averageScore}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
};

function ListSkeleton({ rows = 4 }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.5, py: 1 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="60%" />
            <Skeleton width="35%" />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

function PersonAvatar({ name }) {
  return (
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
      {initials(name)}
    </Avatar>
  );
}

export default function StaffDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const { data, error, loading, reload } = useApiData(() => getOverview(), []);
  const [courseDialog, setCourseDialog] = useState(false);
  // Icons crowd the labels in the two-column phone layout.
  const showIcons = useMediaQuery((t) => t.breakpoints.up('sm'));
  const ic = (icon) => (showIcons ? icon : undefined);

  const totals = data?.totals || {};
  const noCourses = !loading && !error && data && !totals.courses;

  return (
    <Box>
      <PageHeader
        eyebrow={todayLabel.format(new Date())}
        title={`${greeting()}, ${firstName(currentUser?.name) || 'there'}`}
        description="Here is what is happening across your courses."
        actions={
          <>
            <Button variant="outlined" color="inherit" startIcon={<AddRoundedIcon />} onClick={() => setCourseDialog(true)}>
              New course
            </Button>
            <Button variant="contained" startIcon={<AddRoundedIcon />} component={RouterLink} to="/app/assessments/new">
              New assessment
            </Button>
          </>
        }
      />

      <OnboardingChecklist sx={{ mb: 3 }} />

      {error ? (
        <ErrorState error={error} onRetry={reload} title="We couldn’t load your dashboard" />
      ) : noCourses ? (
        <EmptyState
          icon={<LibraryBooksOutlinedIcon />}
          title="Create your first course"
          description="Courses hold your students, assessments and analytics. Create one, then share its join code with your class."
          action={
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => setCourseDialog(true)}>
              New course
            </Button>
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 3 }}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: {
                xs: '1fr 1fr',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(5, 1fr)',
              },
              '& > :last-child': { gridColumn: { xs: '1 / -1', md: 'auto' } },
            }}
          >
            <StatCard
              label="Students"
              value={totals.students ?? 0}
              icon={ic(<GroupsOutlinedIcon />)}
              loading={loading}
              hint={`across ${totals.courses ?? 0} course${totals.courses === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Active courses"
              value={totals.courses ?? 0}
              icon={ic(<LibraryBooksOutlinedIcon />)}
              tone="secondary"
              loading={loading}
              onClick={() => navigate('/app/courses')}
            />
            <StatCard
              label="Submissions"
              hint="last 30 days"
              value={totals.submissions30d ?? 0}
              icon={ic(<AssignmentTurnedInOutlinedIcon />)}
              tone="info"
              loading={loading}
            />
            <StatCard
              label="Average score"
              value={formatPercent(data?.averageScore)}
              icon={ic(<InsightsOutlinedIcon />)}
              tone="success"
              loading={loading}
            />
            <StatCard
              label="Pass rate"
              value={formatPercent(data?.passRate)}
              icon={ic(<FactCheckOutlinedIcon />)}
              tone="warning"
              loading={loading}
            />
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', lg: '2fr 1fr' },
              alignItems: 'start',
            }}
          >
            <SectionCard title="Last 8 weeks" subtitle="Finished, graded attempts in your courses">
              <TrendCharts trend={data?.trend} loading={loading} />
            </SectionCard>

            <SectionCard title="Upcoming deadlines" subtitle="Next 14 days" contentSx={{ px: 1 }}>
              {loading ? (
                <Box sx={{ px: 1.5 }}>
                  <ListSkeleton rows={3} />
                </Box>
              ) : !data?.upcomingDeadlines?.length ? (
                <Box sx={{ px: 1.5 }}>
                  <EmptyState
                    compact
                    icon={<EventOutlinedIcon />}
                    title="Nothing due soon"
                    description="No published assessments are due in the next two weeks."
                  />
                </Box>
              ) : (
                <List disablePadding>
                  {data.upcomingDeadlines.map((d) => {
                    const pct = d.enrolled ? Math.round((d.submitted / d.enrolled) * 100) : 0;
                    return (
                      <ListItemButton
                        key={d.id}
                        component={RouterLink}
                        to={`/app/assessments/${d.id}/submissions`}
                        sx={{ borderRadius: 2, display: 'block', py: 1.25 }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 1,
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                            {d.title}
                          </Typography>
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              flex: 'none',
                              fontWeight: 600,
                            }}
                          >
                            {formatRelative(d.dueDate)}
                          </Typography>
                        </Box>
                        <Typography variant="caption" component="p" sx={{ color: 'text.secondary' }} noWrap>
                          {d.courseTitle}
                        </Typography>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            mt: 0.75,
                          }}
                        >
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                            aria-label={`${d.submitted} of ${d.enrolled} submitted`}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {d.submitted}/{d.enrolled}
                          </Typography>
                        </Box>
                      </ListItemButton>
                    );
                  })}
                </List>
              )}
            </SectionCard>
          </Box>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              alignItems: 'start',
            }}
          >
            <SectionCard
              title="Students at risk"
              subtitle="Average below 50% over 2+ assessments, or a terminated attempt"
              contentSx={{ px: 1 }}
            >
              {loading ? (
                <Box sx={{ px: 1.5 }}>
                  <ListSkeleton />
                </Box>
              ) : !data?.atRiskStudents?.length ? (
                <Box sx={{ px: 1.5 }}>
                  <EmptyState
                    compact
                    icon={<SentimentSatisfiedAltOutlinedIcon />}
                    title="No one is at risk right now"
                    description="Students appear here when their average drops below 50% or an attempt is terminated."
                  />
                </Box>
              ) : (
                <List disablePadding>
                  {data.atRiskStudents.map((s) => (
                    <ListItemButton
                      key={`${s.id}-${s.courseId}`}
                      component={RouterLink}
                      to={`/app/courses/${s.courseId}/students`}
                      sx={{ borderRadius: 2, gap: 1.5, alignItems: 'center' }}
                    >
                      <PersonAvatar name={s.name} />
                      <ListItemText
                        primary={s.name}
                        secondary={s.courseTitle}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 600,
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          noWrap: true,
                        }}
                        sx={{ minWidth: 0 }}
                      />
                      <Box
                        sx={{
                          display: { xs: 'none', sm: 'flex' },
                          gap: 0.5,
                          flexWrap: 'wrap',
                          justifyContent: 'flex-end',
                        }}
                      >
                        {(s.reasons || []).map((r) => (
                          <ToneChip key={r} label={AT_RISK_REASONS[r]?.label || r} tone={AT_RISK_REASONS[r]?.tone || 'warning'} />
                        ))}
                      </Box>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          minWidth: 48,
                          textAlign: 'right',
                          color: 'error.main',
                        }}
                      >
                        {formatPercent(s.averageScore)}
                      </Typography>
                    </ListItemButton>
                  ))}
                </List>
              )}
            </SectionCard>

            <SectionCard title="Recent submissions" contentSx={{ px: 1 }}>
              {loading ? (
                <Box sx={{ px: 1.5 }}>
                  <ListSkeleton />
                </Box>
              ) : !data?.recentSubmissions?.length ? (
                <Box sx={{ px: 1.5 }}>
                  <EmptyState
                    compact
                    icon={<TaskAltRoundedIcon />}
                    title="No submissions yet"
                    description="Publish an assessment and your students’ work will show up here."
                  />
                </Box>
              ) : (
                <List disablePadding>
                  {data.recentSubmissions.map((s) => (
                    <ListItemButton
                      key={s.id}
                      component={RouterLink}
                      to={`/app/submissions/${s.id}`}
                      sx={{ borderRadius: 2, gap: 1.5, alignItems: 'center' }}
                    >
                      <PersonAvatar name={s.student?.name} />
                      <ListItemText
                        primary={s.student?.name}
                        secondary={`${s.assessment?.title} · ${formatRelative(s.submittedAt)}`}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 600,
                          noWrap: true,
                        }}
                        secondaryTypographyProps={{
                          variant: 'caption',
                          noWrap: true,
                        }}
                        sx={{ minWidth: 0 }}
                      />
                      {s.needsReview && (
                        <ToneChip
                          label="Needs review"
                          tone="warning"
                          icon={<RateReviewOutlinedIcon />}
                          sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                        />
                      )}
                      {s.status === 'terminated' && <ToneChip label="Terminated" tone="error" />}
                      <ToneChip
                        label={formatPercent(s.percentage)}
                        tone={scoreTone(s.percentage)}
                        sx={{
                          minWidth: 52,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      />
                      <ChevronRightRoundedIcon
                        sx={{
                          color: 'text.disabled',
                          display: { xs: 'none', sm: 'block' },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              )}
            </SectionCard>
          </Box>
        </Box>
      )}

      <CourseFormDialog
        open={courseDialog}
        onClose={() => setCourseDialog(false)}
        onSaved={(c) => {
          setCourseDialog(false);
          navigate(`/app/courses/${c.id}`);
        }}
      />
    </Box>
  );
}
