import CheckBoxOutlineBlankRoundedIcon from '@mui/icons-material/CheckBoxOutlineBlankRounded';
import CheckBoxRoundedIcon from '@mui/icons-material/CheckBoxRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import RadioButtonCheckedRoundedIcon from '@mui/icons-material/RadioButtonCheckedRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import React, { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { listAssessmentSubmissions } from '../../api/assessments';
import { getSubmission, gradeSubmission } from '../../api/submissions';
import { EmptyState, ScoreRing } from '../../components/common';
import IntegrityTimeline from '../../components/staff/IntegrityTimeline';
import { ErrorState, MetaItem, SectionCard, SubmissionStatusChip, ToneChip } from '../../components/staff/StaffUI';
import { answerText, formatDateTime, formatDuration, questionTypeLabel, scoreTone } from '../../components/staff/staffUtils';
import useApiData from '../../components/staff/useApiData';
import { useBreadcrumb } from '../../components/layout/breadcrumb';
import usePlanError from '../../components/staff/usePlanError';
import { useNotify } from '../../contexts/NotificationContext';

const asList = (v) => (Array.isArray(v) ? v : v === null || v === undefined || v === '' ? [] : [v]);
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();

function ChoiceAnswer({ q }) {
  const chosen = asList(q.answer);
  const keys = asList(q.correctAnswer);
  const multi = q.type === 'multiple-select';
  return (
    <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 0.75 }}>
      {(q.options || []).map((o) => {
        const picked = chosen.some((c) => same(c, o));
        const correct = keys.some((k) => same(k, o));
        const tone = correct ? 'success' : picked ? 'error' : null;
        const Icon = multi ? (picked ? CheckBoxRoundedIcon : CheckBoxOutlineBlankRoundedIcon) : picked ? RadioButtonCheckedRoundedIcon : RadioButtonUncheckedRoundedIcon;
        return (
          <Box
            component="li"
            key={o}
            sx={(t) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              px: 1.25,
              py: 0.75,
              borderRadius: 2,
              border: '1px solid',
              borderColor: tone ? alpha(t.palette[tone].main, 0.45) : 'divider',
              bgcolor: tone ? alpha(t.palette[tone].main, 0.07) : 'transparent',
            })}
          >
            <Icon fontSize="small" sx={{ color: picked ? 'text.primary' : 'text.disabled' }} aria-hidden="true" />
            <Typography variant="body2" sx={{ flex: 1, fontWeight: picked ? 600 : 400 }}>
              {o}
            </Typography>
            {picked && (
              <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                Student’s answer
              </Typography>
            )}
            {correct && <ToneChip label="Correct" tone="success" />}
          </Box>
        );
      })}
      {!chosen.length && (
        <Typography variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
          No answer given
        </Typography>
      )}
    </Box>
  );
}

function WrittenAnswer({ q }) {
  const text = answerText(q.answer);
  const keys = asList(q.correctAnswer);
  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
          Student’s answer
        </Typography>
        <Paper
          variant="outlined"
          sx={{ p: 1.5, mt: 0.5, borderRadius: 2, whiteSpace: 'pre-wrap', bgcolor: 'action.hover', fontSize: 14, lineHeight: 1.6, wordBreak: 'break-word' }}
        >
          {text || (
            <Typography component="span" variant="body2" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
              No answer given
            </Typography>
          )}
        </Paper>
        {text && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {text.trim().split(/\s+/).length} words
          </Typography>
        )}
      </Box>
      {keys.length > 0 && (
        <Box>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700 }}>
            {q.type === 'short-answer' ? 'Accepted answers' : 'Model answer / marking guide'}
          </Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: 'success.main', whiteSpace: 'pre-wrap' }}>
            {keys.join(q.type === 'short-answer' ? ' · ' : '\n')}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

function QuestionReview({ q, index, points, onPoints }) {
  const r = q.result || {};
  const max = r.maxPoints ?? q.points;
  const changed = Number(points) !== Number(r.pointsEarned);
  const invalid = points === '' || Number(points) < 0 || Number(points) > max || !Number.isFinite(Number(points));
  return (
    <Paper
      variant="outlined"
      id={`q-${q.id}`}
      sx={(t) => ({
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        borderColor: r.needsReview ? alpha(t.palette.warning.main, 0.7) : 'divider',
        borderLeftWidth: r.needsReview ? 4 : 1,
      })}
    >
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap', mb: 1.5 }}>
        <Box sx={{ flex: '1 1 240px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 0.75 }}>
            <ToneChip label={`Q${index + 1}`} />
            <ToneChip label={questionTypeLabel(q.type)} />
            {q.topic && <ToneChip label={q.topic} tone="primary" />}
            {r.needsReview && <ToneChip label="Needs review" tone="warning" icon={<RateReviewOutlinedIcon />} />}
          </Box>
          <Typography variant="body1" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
            {q.text}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {r.needsReview ? null : r.isCorrect ? (
            <CheckCircleRoundedIcon color="success" aria-label="Correct" />
          ) : (
            <CancelRoundedIcon color="error" aria-label={Number(r.pointsEarned) > 0 ? 'Partially correct' : 'Incorrect'} />
          )}
          <TextField
            size="small"
            type="number"
            value={points}
            onChange={(e) => onPoints(e.target.value === '' ? '' : Number(e.target.value))}
            error={invalid}
            inputProps={{ min: 0, max, step: 0.5, 'aria-label': `Points for question ${index + 1}, out of ${max}` }}
            InputProps={{ endAdornment: <InputAdornment position="end">/ {max}</InputAdornment> }}
            sx={(t) => ({ width: 120, '& .MuiOutlinedInput-root': changed ? { bgcolor: alpha(t.palette.primary.main, 0.06) } : undefined })}
          />
        </Box>
      </Box>
      {['multiple-choice', 'multiple-select', 'true-false'].includes(q.type) ? <ChoiceAnswer q={q} /> : <WrittenAnswer q={q} />}
      {r.feedback && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
          <strong>Auto-grader:</strong> {r.feedback}
        </Typography>
      )}
      {q.explanation && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
          <strong>Explanation:</strong> {q.explanation}
        </Typography>
      )}
    </Paper>
  );
}

export default function SubmissionReview() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const handleError = usePlanError();
  const { data: s, error, loading, reload, setData } = useApiData(() => getSubmission(submissionId), [submissionId]);
  const assessmentId = s?.assessment?.id;
  useBreadcrumb(
    s?.student?.name ? `${s.student.name} · attempt ${s.attempt}` : null,
    assessmentId ? { label: s?.assessment?.title || 'Submissions', to: `/app/assessments/${assessmentId}/submissions` } : undefined
  );
  const siblings = useApiData(() => listAssessmentSubmissions(assessmentId), [assessmentId], { enabled: !!assessmentId });
  const [points, setPoints] = useState({});
  const [override, setOverride] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!s) return;
    setPoints(Object.fromEntries((s.questions || []).map((q) => [q.id, q.result?.pointsEarned ?? 0])));
    setOverride(typeof s.override?.score === 'number' ? s.override.score : '');
    setComment(s.override?.comment || '');
  }, [s]);

  const order = useMemo(() => (siblings.data?.items || []).filter((x) => x.status !== 'in-progress'), [siblings.data]);
  const pos = order.findIndex((x) => x.id === submissionId);
  const prev = pos > 0 ? order[pos - 1] : null;
  const next = pos >= 0 && pos < order.length - 1 ? order[pos + 1] : null;

  const questions = useMemo(() => s?.questions || [], [s]);
  const pointsTotal = questions.reduce((sum, q) => sum + (Number(points[q.id]) || 0), 0);
  const changedScores = Object.fromEntries(
    questions.filter((q) => Number(points[q.id]) !== Number(q.result?.pointsEarned) || q.result?.needsReview).map((q) => [q.id, Number(points[q.id])])
  );
  const overrideChanged = String(override) !== String(typeof s?.override?.score === 'number' ? s.override.score : '');
  const commentChanged = comment !== (s?.override?.comment || '');
  const pendingReview = questions.filter((q) => q.result?.needsReview).length;
  const anyInvalid = questions.some((q) => {
    const v = points[q.id];
    const max = q.result?.maxPoints ?? q.points;
    return v === '' || !Number.isFinite(Number(v)) || Number(v) < 0 || Number(v) > max;
  }) || (override !== '' && (Number(override) < 0 || Number(override) > (s?.maxScore || 0)));
  const dirty = Object.keys(changedScores).length > 0 || overrideChanged || commentChanged;

  const save = async () => {
    const body = {};
    if (Object.keys(changedScores).length) body.questionScores = changedScores;
    if (overrideChanged) body.overrideScore = override === '' ? null : Number(override);
    if (commentChanged) body.comment = comment;
    setSaving(true);
    try {
      const updated = await gradeSubmission(submissionId, body);
      setData((prev) => ({ ...prev, ...updated }));
      siblings.reload({ silent: true });
      notify('Grade saved — the student has been notified', 'success');
    } catch (err) {
      handleError(err, 'Could not save the grade');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    if (error.status === 404)
      return (
        <EmptyState
          icon={<SearchOffRoundedIcon />}
          title="Submission not found"
          action={
            <Button component={RouterLink} to="/app" variant="contained">
              Back to dashboard
            </Button>
          }
        />
      );
    return <ErrorState error={error} onRetry={reload} title="We couldn’t load this submission" />;
  }

  const pct = s?.percentage;
  const passing = s?.assessment?.passingScore ?? 50;

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1.5 }}>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
          {s ? `${s.course?.title || ''}` : ''}
        </Typography>
        {order.length > 1 && pos >= 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={prev ? `Previous: ${prev.student?.name}` : 'No previous submission'}>
              <span>
                <IconButton aria-label="Previous submission" disabled={!prev} onClick={() => navigate(`/app/submissions/${prev.id}`)}>
                  <ChevronLeftRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
              {pos + 1} of {order.length}
            </Typography>
            <Tooltip title={next ? `Next: ${next.student?.name}` : 'No next submission'}>
              <span>
                <IconButton aria-label="Next submission" disabled={!next} onClick={() => navigate(`/app/submissions/${next.id}`)}>
                  <ChevronRightRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        )}
      </Box>

      {loading || !s ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton width="45%" height={48} />
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={200} />
        </Box>
      ) : (
        <>
          <Box component="header" sx={{ display: 'flex', gap: 2.5, alignItems: 'center', flexWrap: 'wrap', mb: 3 }}>
            <ScoreRing value={pct ?? 0} size={84} tone={scoreTone(pct, passing) === 'error' ? 'error' : 'success'} sublabel={s.isPassed ? 'passed' : 'not passed'} />
            <Box sx={{ minWidth: 0, flex: '1 1 260px' }}>
              <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
                {s.course?.title} · Attempt {s.attempt}
              </Typography>
              <Typography variant="h3" component="h1">
                {s.student?.name}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mt: 0.75 }}>
                <SubmissionStatusChip status={s.status} />
                <ToneChip label={s.isPassed ? 'Passed' : 'Not passed'} tone={s.isPassed ? 'success' : 'error'} />
                {s.needsReview && <ToneChip label="Needs review" tone="warning" icon={<RateReviewOutlinedIcon />} />}
                {typeof s.override?.score === 'number' && <ToneChip label="Score overridden" tone="info" />}
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {s.student?.email}
                </Typography>
              </Box>
            </Box>
          </Box>

          {s.status === 'in-progress' && <Alert severity="info" sx={{ mb: 2 }}>This attempt is still in progress. You can grade it once it’s submitted.</Alert>}

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 340px' }, alignItems: 'start' }}>
            <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
              {pendingReview > 0 && (
                <Alert severity="warning" icon={<RateReviewOutlinedIcon />}>
                  {pendingReview} written answer{pendingReview === 1 ? ' has' : 's have'} a provisional score. Check the points and click “Save grade” to confirm.
                </Alert>
              )}
              {questions.map((q, i) => (
                <QuestionReview key={q.id} q={q} index={i} points={points[q.id] ?? ''} onPoints={(v) => setPoints((p) => ({ ...p, [q.id]: v }))} />
              ))}
            </Box>

            <Box sx={{ display: 'grid', gap: 2, position: { lg: 'sticky' }, top: { lg: 88 } }}>
              <SectionCard title="Grade">
                <Box sx={{ display: 'grid', gap: 2 }}>
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
                    <MetaItem label="Current score" value={`${s.score} / ${s.maxScore} (${pct ?? 0}%)`} />
                    <MetaItem label="Question total" value={`${Math.round(pointsTotal * 100) / 100} / ${s.maxScore}`} />
                  </Box>
                  <TextField
                    label="Override total score"
                    type="number"
                    value={override}
                    onChange={(e) => setOverride(e.target.value === '' ? '' : Number(e.target.value))}
                    inputProps={{ min: 0, max: s.maxScore, step: 0.5 }}
                    InputProps={{ endAdornment: <InputAdornment position="end">/ {s.maxScore}</InputAdornment> }}
                    helperText="Optional. Replaces the per-question total until cleared."
                    error={override !== '' && (Number(override) < 0 || Number(override) > s.maxScore)}
                    size="small"
                  />
                  <TextField
                    label="Comment to student"
                    multiline
                    minRows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    inputProps={{ maxLength: 2000 }}
                    size="small"
                  />
                  <Button
                    variant="contained"
                    onClick={save}
                    disabled={saving || anyInvalid || s.status === 'in-progress' || (!dirty && !pendingReview)}
                    startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
                  >
                    {pendingReview && !dirty ? 'Confirm provisional scores' : 'Save grade'}
                  </Button>
                  {next && (
                    <Button color="inherit" onClick={() => navigate(`/app/submissions/${next.id}`)} endIcon={<ChevronRightRoundedIcon />}>
                      Next submission
                    </Button>
                  )}
                </Box>
              </SectionCard>
              <SectionCard title="Attempt">
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
                  <MetaItem label="Started" value={formatDateTime(s.startedAt)} />
                  <MetaItem label="Submitted" value={formatDateTime(s.submittedAt)} />
                  <MetaItem label="Time spent" value={formatDuration(s.timeSpent)} />
                  <MetaItem label="Results visible" value={s.released ? 'Yes' : 'Not yet'} />
                </Box>
              </SectionCard>
              <SectionCard title="Integrity" subtitle={`${s.integrity?.violationCount || 0} event${s.integrity?.violationCount === 1 ? '' : 's'} recorded`}>
                <IntegrityTimeline integrity={s.integrity} plagiarism={s.plagiarism} startedAt={s.startedAt} submittedAt={s.submittedAt} />
              </SectionCard>
              {s.aiFeedback?.overallFeedback && (
                <SectionCard title="Automatic feedback">
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    {s.aiFeedback.overallFeedback}
                  </Typography>
                </SectionCard>
              )}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
}
