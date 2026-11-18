import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreHorizRoundedIcon from '@mui/icons-material/MoreHorizRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { Box, Button, IconButton, Menu, MenuItem, Skeleton, Tab, Tabs, Typography } from '@mui/material';
import React, { Suspense, lazy, useState } from 'react';
import { Navigate, Link as RouterLink, useParams } from 'react-router-dom';
import { getAssessmentAnalytics } from '../../api/analytics';
import { getAssessment, listAssessmentSubmissions } from '../../api/assessments';
import { EmptyState } from '../../components/common';
import { AssessmentStatusChip, ErrorState, TableSkeleton, ToneChip, useIsMobile } from '../../components/staff/StaffUI';
import { formatDateTime, pluralize } from '../../components/staff/staffUtils';
import useApiData from '../../components/staff/useApiData';
import { useBreadcrumb } from '../../components/layout/breadcrumb';
import useAssessmentActions, { ACTION_LABELS, availableActions } from '../../components/staff/useAssessmentActions';

const OverviewTab = lazy(() => import('../../components/staff/assessment/AssessmentOverviewTab'));
const SubmissionsTab = lazy(() => import('../../components/staff/assessment/AssessmentSubmissionsTab'));
const AnalyticsTab = lazy(() => import('../../components/staff/assessment/AssessmentAnalyticsTab'));
const IntegrityTab = lazy(() => import('../../components/staff/assessment/AssessmentIntegrityTab'));

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'submissions', label: 'Submissions' },
  { value: 'analytics', label: 'Item analysis' },
  { value: 'integrity', label: 'Integrity' },
];

export default function AssessmentDetail() {
  const { assessmentId, tab = 'overview' } = useParams();
  const assessment = useApiData(() => getAssessment(assessmentId), [assessmentId]);
  const analytics = useApiData(() => getAssessmentAnalytics(assessmentId), [assessmentId]);
  const submissions = useApiData(() => listAssessmentSubmissions(assessmentId), [assessmentId]);
  const ad = assessment.data;
  const isMobile = useIsMobile();
  useBreadcrumb(ad?.title, ad ? { label: ad.courseTitle || 'Course', to: `/app/courses/${ad.courseId || ad.course}/assessments` } : undefined);
  const [anchor, setAnchor] = useState(null);
  const { run, dialog } = useAssessmentActions({
    onChanged: (updated, action) => {
      if (action === 'archive') assessment.reload();
      else if (updated && action !== 'duplicate') assessment.setData((prev) => ({ ...prev, ...updated }));
    },
  });

  if (!TABS.some((t) => t.value === tab)) return <Navigate to={`/app/assessments/${assessmentId}`} replace />;

  if (assessment.error) {
    if (assessment.error.status === 404) {
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title="Assessment not found"
          description="It may have been archived, or it belongs to a course you don’t teach."
          action={
            <Button component={RouterLink} to="/app/courses" variant="contained">
              Back to courses
            </Button>
          }
        />
      );
    }
    return <ErrorState error={assessment.error} onRetry={assessment.reload} title="We couldn’t load this assessment" backTo="/app/courses" backLabel="Back to courses" />;
  }

  const a = assessment.data;
  const actions = availableActions(a).filter((x) => x !== 'edit');
  const subItems = submissions.data?.items || [];
  const needsReview = subItems.filter((s) => s.needsReview).length;
  const flagged = subItems.filter((s) => s.violationCount > 0 || s.plagiarismFlag || s.status === 'terminated').length;
  const tabProps = { assessment: a, assessmentId, analytics, submissions };
  const badge = (n) =>
    n ? (
      <Box component="span" sx={{ ml: 0.75, px: 0.75, borderRadius: 1, fontSize: 11, fontWeight: 700, bgcolor: 'warning.main', color: 'warning.contrastText' }}>
        {n}
      </Box>
    ) : null;

  return (
    <Box>
      {assessment.loading || !a ? (
        <Box sx={{ mb: 3 }}>
          <Skeleton width={140} />
          <Skeleton width="55%" height={48} />
          <Skeleton width="35%" />
        </Box>
      ) : (
        <Box component="header" sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', justifyContent: 'space-between', mb: 2.5 }}>
          <Box sx={{ minWidth: 0, flex: '1 1 360px' }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
              <AssessmentStatusChip status={a.status} />
              {a.resultsPolicy !== 'immediate' && (
                <ToneChip
                  label={a.resultsReleased ? 'Results released' : a.resultsPolicy === 'manual' ? 'Results hidden until released' : 'Results after due date'}
                  tone={a.resultsReleased ? 'success' : 'warning'}
                />
              )}
              {a.proctoring?.enabled && <ToneChip label="Proctored" tone="info" />}
            </Box>
            <Typography variant="h3" component="h1" sx={{ wordBreak: 'break-word' }}>
              {a.title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
              {pluralize(a.questionCount ?? a.questions?.length ?? 0, 'question')} · {a.totalPoints} points
              {a.timeLimit ? ` · ${a.timeLimit} min` : ''} · {a.dueDate ? `Due ${formatDateTime(a.dueDate)}` : 'No due date'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {a.status !== 'archived' && (
              <Button variant="outlined" color="inherit" startIcon={<EditOutlinedIcon />} component={RouterLink} to={`/app/assessments/${a.id}/edit`}>
                Edit
              </Button>
            )}
            {actions.includes('publish') && (
              <Button variant="contained" onClick={() => run('publish', a)}>
                Publish
              </Button>
            )}
            {actions.includes('release') && (
              <Button variant="contained" onClick={() => run('release', a)}>
                Release results
              </Button>
            )}
            <IconButton aria-label="More actions" onClick={(e) => setAnchor(e.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
              <MoreHorizRoundedIcon />
            </IconButton>
            <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
              {actions
                .filter((x) => x !== 'publish' && x !== 'release')
                .map((x) => (
                  <MenuItem
                    key={x}
                    onClick={() => {
                      setAnchor(null);
                      run(x, a);
                    }}
                    sx={x === 'archive' ? { color: 'error.main' } : undefined}
                  >
                    {ACTION_LABELS[x]}
                  </MenuItem>
                ))}
            </Menu>
          </Box>
        </Box>
      )}

      <Tabs value={tab} variant="scrollable" scrollButtons={isMobile ? 'auto' : false} allowScrollButtonsMobile aria-label="Assessment sections" sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            component={RouterLink}
            to={t.value === 'overview' ? `/app/assessments/${assessmentId}` : `/app/assessments/${assessmentId}/${t.value}`}
            label={
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center' }}>
                {t.label}
                {t.value === 'submissions' && badge(needsReview)}
                {t.value === 'integrity' && badge(flagged)}
              </Box>
            }
          />
        ))}
      </Tabs>

      {!a ? (
        <TableSkeleton rows={6} columns={5} />
      ) : (
        <Suspense fallback={<TableSkeleton rows={6} columns={5} />}>
          {tab === 'overview' && <OverviewTab {...tabProps} />}
          {tab === 'submissions' && <SubmissionsTab {...tabProps} />}
          {tab === 'analytics' && <AnalyticsTab {...tabProps} />}
          {tab === 'integrity' && <IntegrityTab {...tabProps} />}
        </Suspense>
      )}
      {dialog}
    </Box>
  );
}
