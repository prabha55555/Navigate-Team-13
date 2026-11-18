import { Alert, Box, Typography } from '@mui/material';
import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  archiveAssessment,
  closeAssessment,
  duplicateAssessment,
  publishAssessment,
  releaseResults,
} from '../../api/assessments';
import { useNotify } from '../../contexts/NotificationContext';
import { restoreAssessment, unpublishAssessment } from '../../api/assessments';
import ConfirmDialog from './ConfirmDialog';
import usePlanError from './usePlanError';

/** Which lifecycle actions make sense for an assessment in its current state. */
export const availableActions = (a) => {
  if (!a) return [];
  const list = [];
  if (a.status !== 'archived') list.push('edit');
  if (a.status === 'draft') list.push('publish');
  if (a.status === 'published') list.push('close');
  if (a.status === 'published' && !a.submissionCount) list.push('unpublish');
  if ((a.status === 'published' || a.status === 'closed') && a.resultsPolicy !== 'immediate' && !a.resultsReleased) list.push('release');
  list.push('duplicate');
  if (a.status !== 'archived') list.push('archive');
  else list.push('restore');
  return list;
};

export const ACTION_LABELS = {
  edit: 'Edit',
  publish: 'Publish',
  close: 'Close',
  release: 'Release results',
  duplicate: 'Duplicate',
  archive: 'Archive',
  restore: 'Restore as draft',
  unpublish: 'Revert to draft',
};

const CONFIRM = {
  publish: (a) => ({
    title: 'Publish this assessment?',
    description: `Enrolled students will be notified and can start “${a.title}”${a.availableFrom ? ' once it opens' : ' right away'}. Questions are locked once someone starts.`,
    confirmLabel: 'Publish',
    tone: 'primary',
  }),
  close: (a) => ({
    title: 'Close this assessment?',
    description: `Students can no longer start “${a.title}”. Attempts already in progress can still be submitted until their deadline.`,
    confirmLabel: 'Close assessment',
    tone: 'warning',
  }),
  release: (a) => ({
    title: 'Release results?',
    description: `Every student who submitted “${a.title}” will be able to see their score${a.showCorrectAnswers ? ' and the correct answers' : ''}, and will be notified.`,
    confirmLabel: 'Release results',
    tone: 'primary',
  }),
  unpublish: (a) => ({
    title: 'Revert to draft?',
    description: `“${a.title}” will be hidden from students again until you republish it. This is only possible while nobody has started it.`,
    confirmLabel: 'Revert to draft',
    tone: 'warning',
  }),
  archive: (a) => ({
    title: 'Archive this assessment?',
    description: `“${a.title}” will be hidden from students and your lists. Submissions and grades are kept.`,
    confirmLabel: 'Archive',
    tone: 'error',
  }),
};

/**
 * Shared lifecycle actions (publish, close, release, duplicate, archive) with
 * confirmations and toasts. Render `dialog` somewhere in the page.
 * `onChanged(updatedAssessment | null, action)` runs after a successful change.
 */
export default function useAssessmentActions({ onChanged } = {}) {
  const notify = useNotify();
  const navigate = useNavigate();
  const handleError = usePlanError();
  const [pending, setPending] = useState(null);
  const [problems, setProblems] = useState(null);

  const perform = useCallback(
    async (action, a) => {
      try {
        let updated = null;
        if (action === 'publish') {
          updated = await publishAssessment(a.id);
          notify('Published — students have been notified', 'success');
        } else if (action === 'close') {
          updated = await closeAssessment(a.id);
          notify('Assessment closed', 'success');
        } else if (action === 'release') {
          updated = await releaseResults(a.id);
          notify('Results released', 'success');
        } else if (action === 'archive') {
          await archiveAssessment(a.id);
          notify('Assessment archived', 'success');
        } else if (action === 'unpublish') {
          updated = await unpublishAssessment(a.id);
          notify('Reverted to draft — students can no longer see it', 'success');
        } else if (action === 'restore') {
          updated = await restoreAssessment(a.id);
          notify('Restored as a draft', 'success');
        } else if (action === 'duplicate') {
          updated = await duplicateAssessment(a.id);
          notify('Copy created as a draft', 'success');
          navigate(`/app/assessments/${updated.id}/edit`);
        }
        setPending(null);
        onChanged?.(updated, action);
      } catch (err) {
        const list = err?.details?.problems;
        if (action === 'publish' && Array.isArray(list) && list.length) {
          setPending(null);
          setProblems({ assessment: a, list });
        } else if (action === 'unpublish' && err?.status === 409) {
          setPending(null);
          notify(err.message || 'A student has already started it — close it instead.', 'warning');
        } else handleError(err, `Could not ${ACTION_LABELS[action]?.toLowerCase() || action}`);
      }
    },
    [handleError, navigate, notify, onChanged]
  );

  const run = useCallback(
    (action, a) => {
      if (action === 'edit') {
        navigate(`/app/assessments/${a.id}/edit`);
        return;
      }
      if (CONFIRM[action]) setPending({ action, assessment: a, ...CONFIRM[action](a) });
      else perform(action, a);
    },
    [navigate, perform]
  );

  const dialog = (
    <>
      <ConfirmDialog
        open={!!pending}
        title={pending?.title}
        description={pending?.description}
        confirmLabel={pending?.confirmLabel}
        tone={pending?.tone}
        onConfirm={() => perform(pending.action, pending.assessment)}
        onClose={() => setPending(null)}
      />
      <ConfirmDialog
        open={!!problems}
        title="Not ready to publish"
        confirmLabel="Fix in editor"
        onConfirm={() => {
          const id = problems.assessment.id;
          setProblems(null);
          navigate(`/app/assessments/${id}/edit`);
        }}
        onClose={() => setProblems(null)}
      >
        <Alert severity="warning" sx={{ mb: 1 }}>
          Fix these first:
        </Alert>
        <Box component="ul" sx={{ pl: 2.5, my: 0 }}>
          {(problems?.list || []).map((p) => (
            <Typography component="li" variant="body2" key={p}>
              {p}
            </Typography>
          ))}
        </Box>
      </ConfirmDialog>
    </>
  );

  return { run, dialog };
}
