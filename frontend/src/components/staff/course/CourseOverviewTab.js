import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SentimentSatisfiedAltOutlinedIcon from '@mui/icons-material/SentimentSatisfiedAltOutlined';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import { Box, Button, List, ListItemButton, ListItemText, Skeleton, Typography } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getOverview } from '../../../api/analytics';
import { EmptyState, StatCard } from '../../common';
import { ErrorState, SectionCard, ToneChip, useIsMobile } from '../StaffUI';
import { AT_RISK_REASONS, formatPercent, formatRelative, scoreTone } from '../staffUtils';
import useApiData from '../useApiData';
import ScoreDistributionChart from './ScoreDistributionChart';

export default function CourseOverviewTab({ course, courseId, analytics, onInvite }) {
  const isMobile = useIsMobile();
  const overview = useApiData(() => getOverview(), []);
  const a = analytics.data;
  const sum = a?.summary || {};
  const recent = (overview.data?.recentSubmissions || []).filter((s) => s.courseId === courseId);
  const upcoming = (overview.data?.upcomingDeadlines || []).filter((d) => d.courseId === courseId);

  if (analytics.error) return <ErrorState error={analytics.error} onRetry={analytics.reload} title="We couldn’t load course analytics" />;
  const loading = analytics.loading;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {!loading && course.studentCount === 0 && (
        <EmptyState
          compact
          icon={<PersonAddAlt1OutlinedIcon />}
          title="No students yet"
          description="Share the join code or add students by email to get started."
          action={
            <Button variant="contained" onClick={onInvite} startIcon={<PersonAddAlt1OutlinedIcon />}>
              Invite students
            </Button>
          }
        />
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard label="Students" value={sum.students ?? course.studentCount ?? 0} icon={isMobile ? undefined : <GroupsOutlinedIcon />} loading={loading} />
        <StatCard label="Graded students" value={sum.gradedStudents ?? 0} hint="with at least one graded attempt" icon={isMobile ? undefined : <AssignmentTurnedInOutlinedIcon />} tone="info" loading={loading} />
        <StatCard label="Average score" value={formatPercent(sum.averageScore)} hint="best graded attempt per student" icon={isMobile ? undefined : <InsightsOutlinedIcon />} tone="success" loading={loading} />
        <StatCard label="Pass rate" value={formatPercent(sum.passRate)} hint="best graded attempt per student" icon={isMobile ? undefined : <FactCheckOutlinedIcon />} tone="warning" loading={loading} />
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'start' }}>
        <SectionCard title="Score distribution" subtitle="Published assessments, each student’s best graded attempt">
          {loading ? <Skeleton variant="rounded" height={240} /> : <ScoreDistributionChart distribution={a?.scoreDistribution} />}
        </SectionCard>
        <SectionCard
          title="Students at risk"
          subtitle="Average below 50% or a terminated attempt"
          contentSx={{ px: 1 }}
          action={
            <Button size="small" component={RouterLink} to={`/app/courses/${courseId}/students`}>
              Roster
            </Button>
          }
        >
          {loading ? (
            <Box sx={{ px: 1.5 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={44} />
              ))}
            </Box>
          ) : !a?.atRiskStudents?.length ? (
            <Box sx={{ px: 1.5 }}>
              <EmptyState compact icon={<SentimentSatisfiedAltOutlinedIcon />} title="No one is at risk" description="Nice — every student is on track." />
            </Box>
          ) : (
            <List disablePadding>
              {a.atRiskStudents.map((s) => (
                <ListItemButton key={s.id} component={RouterLink} to={`/app/courses/${courseId}/gradebook`} sx={{ borderRadius: 2, gap: 1 }}>
                  <ListItemText
                    primary={s.name}
                    secondary={`${s.gradedAssessments} graded assessments`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                    sx={{ minWidth: 0 }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {(s.reasons || []).map((r) => (
                      <ToneChip key={r} label={AT_RISK_REASONS[r]?.label || r} tone={AT_RISK_REASONS[r]?.tone || 'warning'} />
                    ))}
                  </Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: 'error.main', minWidth: 44, textAlign: 'right' }}>
                    {formatPercent(s.averageScore)}
                  </Typography>
                </ListItemButton>
              ))}
            </List>
          )}
        </SectionCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, alignItems: 'start' }}>
        <SectionCard title="Recent activity" contentSx={{ px: 1 }}>
          {overview.loading ? (
            <Box sx={{ px: 1.5 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={44} />
              ))}
            </Box>
          ) : overview.error ? (
            <Box sx={{ px: 1.5 }}>
              <ErrorState error={overview.error} onRetry={overview.reload} />
            </Box>
          ) : !recent.length ? (
            <Box sx={{ px: 1.5 }}>
              <EmptyState compact icon={<TaskAltRoundedIcon />} title="No recent submissions" description="New submissions for this course will appear here." />
            </Box>
          ) : (
            <List disablePadding>
              {recent.map((s) => (
                <ListItemButton key={s.id} component={RouterLink} to={`/app/submissions/${s.id}`} sx={{ borderRadius: 2, gap: 1 }}>
                  <ListItemText
                    primary={`${s.student?.name} submitted ${s.assessment?.title}`}
                    secondary={formatRelative(s.submittedAt)}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                    sx={{ minWidth: 0 }}
                  />
                  {s.needsReview && <ToneChip label="Needs review" tone="warning" />}
                  <ToneChip label={formatPercent(s.percentage)} tone={scoreTone(s.percentage)} />
                </ListItemButton>
              ))}
            </List>
          )}
        </SectionCard>
        <SectionCard title="Coming up" subtitle="Due in the next 14 days" contentSx={{ px: 1 }}>
          {overview.loading ? (
            <Box sx={{ px: 1.5 }}>
              {[0, 1].map((i) => (
                <Skeleton key={i} height={44} />
              ))}
            </Box>
          ) : !upcoming.length ? (
            <Box sx={{ px: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', py: 2 }}>
                Nothing due in the next two weeks.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {upcoming.map((d) => (
                <ListItemButton key={d.id} component={RouterLink} to={`/app/assessments/${d.id}`} sx={{ borderRadius: 2 }}>
                  <ListItemText
                    primary={d.title}
                    secondary={`Due ${formatRelative(d.dueDate)} · ${d.submitted}/${d.enrolled} submitted`}
                    primaryTypographyProps={{ variant: 'body2', fontWeight: 600, noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              ))}
            </List>
          )}
        </SectionCard>
      </Box>
    </Box>
  );
}
