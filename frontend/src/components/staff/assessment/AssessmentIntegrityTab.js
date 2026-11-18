import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Skeleton,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { getSubmission } from '../../../api/submissions';
import { EmptyState, StatCard } from '../../common';
import IntegrityTimeline from '../IntegrityTimeline';
import { ErrorState, SubmissionStatusChip, ToneChip } from '../StaffUI';
import { formatDateTime } from '../staffUtils';

function FlaggedAttempt({ s, maxViolations }) {
  const [state, setState] = useState({ loading: false, data: null, error: null });
  const load = async () => {
    if (state.data || state.loading) return;
    setState({ loading: true, data: null, error: null });
    try {
      const data = await getSubmission(s.id);
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error });
    }
  };
  return (
    <Accordion
      disableGutters
      variant="outlined"
      onChange={(_, open) => open && load()}
      sx={{ borderRadius: '12px !important', '&:before': { display: 'none' }, overflow: 'hidden' }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', width: '100%', pr: 1 }}>
          <Box sx={{ minWidth: 0, flex: '1 1 180px' }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {s.student?.name}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Attempt {s.attempt} · {s.submittedAt ? formatDateTime(s.submittedAt) : 'in progress'}
            </Typography>
          </Box>
          <SubmissionStatusChip status={s.status} />
          {s.violationCount > 0 && (
            <ToneChip label={`${s.violationCount}${maxViolations ? ` / ${maxViolations}` : ''} violations`} tone={s.status === 'terminated' ? 'error' : 'warning'} />
          )}
          {s.plagiarismFlag && <ToneChip label="Similar to another answer" tone="error" />}
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        {state.loading ? (
          <Box>
            <Skeleton width="60%" />
            <Skeleton width="50%" />
            <Skeleton width="55%" />
          </Box>
        ) : state.error ? (
          <ErrorState error={state.error} onRetry={() => { setState({ loading: false, data: null, error: null }); load(); }} />
        ) : state.data ? (
          <IntegrityTimeline integrity={state.data.integrity} plagiarism={state.data.plagiarism} startedAt={state.data.startedAt} submittedAt={state.data.submittedAt} />
        ) : null}
        <Button component={RouterLink} to={`/app/submissions/${s.id}`} size="small" endIcon={<OpenInNewRoundedIcon />} sx={{ mt: 1.5 }}>
          Open submission
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

export default function AssessmentIntegrityTab({ assessment: a, analytics, submissions }) {
  const integ = analytics.data?.integrity;
  const items = submissions.data?.items || [];
  const flagged = items
    .filter((s) => s.violationCount > 0 || s.plagiarismFlag || s.status === 'terminated')
    .sort((x, y) => (y.status === 'terminated') - (x.status === 'terminated') || y.violationCount - x.violationCount);

  if (submissions.error) return <ErrorState error={submissions.error} onRetry={submissions.reload} />;

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
        <StatCard label="Flagged attempts" value={integ?.flagged ?? flagged.length} tone="warning" loading={analytics.loading} />
        <StatCard label="Terminated" value={integ?.terminated ?? 0} tone="error" loading={analytics.loading} hint={a.proctoring?.enabled ? `after ${a.proctoring.maxViolations} violations` : 'proctoring is off'} />
        <StatCard label="Avg violations per attempt" value={integ ? integ.averageViolations : '—'} tone="info" loading={analytics.loading} />
      </Box>
      {submissions.loading ? (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={64} />
          ))}
        </Box>
      ) : !flagged.length ? (
        <EmptyState
          icon={<GppGoodOutlinedIcon />}
          title="No integrity concerns"
          description={
            a.proctoring?.enabled
              ? 'No student left full screen, switched tabs, pasted text or triggered other events.'
              : 'Events like tab switches and pasting are still recorded. Turn on proctoring in Settings to end attempts after too many violations.'
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gap: 1 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Expand an attempt to see what happened and when. Events are evidence to discuss with the student, not proof of misconduct.
          </Typography>
          {flagged.map((s) => (
            <FlaggedAttempt key={s.id} s={s} maxViolations={a.proctoring?.enabled ? a.proctoring.maxViolations : null} />
          ))}
        </Box>
      )}
    </Box>
  );
}
