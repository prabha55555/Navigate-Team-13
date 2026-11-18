import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import { Alert, Box, Button, Skeleton } from '@mui/material';
import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { StatCard } from '../../common';
import ScoreDistributionChart from '../course/ScoreDistributionChart';
import { ErrorState, MetaItem, SectionCard, useIsMobile } from '../StaffUI';
import { RESULTS_POLICIES, formatDateTime, formatDuration, formatPercent } from '../staffUtils';

export default function AssessmentOverviewTab({ assessment: a, analytics, submissions }) {
  const isMobile = useIsMobile();
  const s = analytics.data?.summary;
  const loading = analytics.loading;
  const needsReview = (submissions.data?.items || []).filter((x) => x.needsReview).length;
  const policy = RESULTS_POLICIES.find((r) => r.value === a.resultsPolicy);

  if (analytics.error) return <ErrorState error={analytics.error} onRetry={analytics.reload} title="We couldn’t load the results summary" />;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {a.status === 'draft' && (
        <Alert
          severity="info"
          action={
            <Button component={RouterLink} to={`/app/assessments/${a.id}/edit?step=3`} color="inherit" size="small">
              Review & publish
            </Button>
          }
        >
          This assessment is a draft. Students can’t see it until you publish it.
        </Alert>
      )}
      {needsReview > 0 && (
        <Alert
          severity="warning"
          icon={<RateReviewOutlinedIcon />}
          action={
            <Button component={RouterLink} to={`/app/assessments/${a.id}/submissions?review=1`} color="inherit" size="small">
              Review now
            </Button>
          }
        >
          {needsReview} submission{needsReview === 1 ? ' has' : 's have'} written answers waiting for your review.
        </Alert>
      )}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
        <StatCard
          label="Students submitted"
          value={s ? s.submissions : 0}
          hint={s && s.attempts !== s.submissions ? `${s.attempts} attempts` : undefined}
          icon={isMobile ? undefined : <AssignmentTurnedInOutlinedIcon />}
          loading={loading}
        />
        <StatCard
          label="Average score"
          value={formatPercent(s?.averageScore, '—', 1)}
          hint={s?.median !== null && s?.median !== undefined ? `median ${formatPercent(s.median, '—', 1)}` : undefined}
          icon={isMobile ? undefined : <InsightsOutlinedIcon />}
          tone="success"
          loading={loading}
        />
        <StatCard
          label="Pass rate"
          value={formatPercent(s?.passRate, '—', 1)}
          hint={`pass mark ${a.passingScore}%`}
          icon={isMobile ? undefined : <FactCheckOutlinedIcon />}
          tone="warning"
          loading={loading}
        />
        <StatCard label="Average time" value={formatDuration(s?.averageTime)} icon={isMobile ? undefined : <TimerOutlinedIcon />} tone="info" loading={loading} />
      </Box>
      <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' }, alignItems: 'start' }}>
        <SectionCard
          title="Score distribution"
          subtitle={s && s.highest !== null && s.highest !== undefined ? `Highest ${formatPercent(s.highest)} · lowest ${formatPercent(s.lowest)}` : 'Each student’s best graded attempt'}
        >
          {loading ? <Skeleton variant="rounded" height={240} /> : <ScoreDistributionChart distribution={analytics.data?.distribution} passingScore={a.passingScore} />}
        </SectionCard>
        <SectionCard title="Settings">
          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: '1fr 1fr' }}>
            <MetaItem label="Opens" value={a.availableFrom ? formatDateTime(a.availableFrom) : 'When published'} />
            <MetaItem label="Due" value={a.dueDate ? formatDateTime(a.dueDate) : 'No due date'} />
            <MetaItem label="Time limit" value={a.timeLimit ? `${a.timeLimit} min` : 'None'} />
            <MetaItem label="Attempts" value={a.maxAttempts} />
            <MetaItem label="Results" value={policy?.label || a.resultsPolicy} sx={{ gridColumn: '1 / -1' }} />
            <MetaItem label="Answer key" value={a.showCorrectAnswers ? 'Shown with results' : 'Hidden'} />
            <MetaItem label="Shuffle" value={[a.shuffleQuestions && 'Questions', a.shuffleOptions && 'Options'].filter(Boolean).join(' & ') || 'Off'} />
            <MetaItem
              label="Proctoring"
              value={a.proctoring?.enabled ? `On · max ${a.proctoring.maxViolations} violations` : 'Off'}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>
        </SectionCard>
      </Box>
    </Box>
  );
}
