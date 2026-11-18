import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import HourglassTopRoundedIcon from '@mui/icons-material/HourglassTopRounded';
import MarkEmailReadOutlinedIcon from '@mui/icons-material/MarkEmailReadOutlined';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';
import RouteRoundedIcon from '@mui/icons-material/RouteRounded';
import {
  Alert,
  Box,
  Button,
  Container,
  Paper,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useMemo, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { getSubmission } from '../../api/submissions';
import dedupe from '../../components/learner/dedupe';
import { InlineCode, PageHeader, ScoreRing, useAsync } from '../../components/common';
import { usePageTitle } from '../../components/layout/breadcrumb';
import { formatDateTime, formatDuration, formatPercent, pluralize } from '../../components/learner/format';
import { ErrorState, Section, ToneBar, ToneChip, topicStatusFor, TOPIC_STATUS } from '../../components/learner/ui';

const answerText = (value) => {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
};

const correctText = (q) => {
  const v = q.correctAnswer;
  if (v == null || v === '') return null;
  if (Array.isArray(v)) return q.type === 'short-answer' ? v.join('  ·  ') : v.join(', ');
  return String(v);
};

const ResultSkeleton = () => (
  <Box aria-busy="true" aria-label="Loading result">
    <Skeleton width={200} />
    <Skeleton width="55%" height={56} sx={{ mb: 3 }} />
    <Skeleton variant="rounded" height={220} sx={{ borderRadius: 4, mb: 3 }} />
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
      <Skeleton variant="rounded" height={200} sx={{ borderRadius: 4 }} />
      <Skeleton variant="rounded" height={200} sx={{ borderRadius: 4 }} />
    </Box>
  </Box>
);

const Meta = ({ label, value }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600 }}>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
  </Box>
);

const QuestionReview = ({ q, index, showKey, isPractice }) => {
  const theme = useTheme();
  const r = q.result || {};
  const needsReview = Boolean(r.needsReview);
  const status = needsReview ? 'review' : r.isCorrect ? 'correct' : (r.pointsEarned || 0) > 0 ? 'partial' : 'incorrect';
  const meta = {
    correct: { tone: 'success', icon: <CheckCircleRoundedIcon />, label: 'Correct' },
    partial: { tone: 'warning', icon: <RemoveCircleOutlineRoundedIcon />, label: 'Partly correct' },
    incorrect: { tone: 'error', icon: <CancelRoundedIcon />, label: 'Incorrect' },
    review: { tone: 'info', icon: <HourglassTopRoundedIcon />, label: 'Needs review' },
  }[status];
  const yours = answerText(q.answer);
  const key = showKey ? correctText(q) : null;
  const written = q.type === 'short-answer' || q.type === 'essay';
  // Essays often use the model answer as the explanation too; don't show it twice.
  const explanation = q.explanation && !(key && !r.isCorrect && q.explanation.trim() === String(key).trim()) ? q.explanation : null;

  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        p: { xs: 2, sm: 2.5 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        borderLeft: `4px solid ${theme.palette[meta.tone].main}`,
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="overline" component="h3" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
          Question {index + 1}
          {q.topic ? ` · ${q.topic}` : ''}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <ToneChip tone={meta.tone} icon={meta.icon} label={meta.label} />
          <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {r.pointsEarned ?? 0}/{r.maxPoints ?? q.points ?? 0} pts
          </Typography>
        </Box>
      </Box>
      <Typography sx={{ fontWeight: 500, mb: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
        <InlineCode text={q.text} />
      </Typography>
      <Box sx={{ display: 'grid', gap: 1 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Your answer
          </Typography>
          <Typography sx={{ whiteSpace: written ? 'pre-wrap' : 'normal', overflowWrap: 'anywhere', fontStyle: yours ? 'normal' : 'italic', color: yours ? 'text.primary' : 'text.secondary' }}>
            {yours ? <InlineCode text={yours} /> : 'No answer'}
          </Typography>
        </Box>
        {key && !r.isCorrect && (
          <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.08) }}>
            <Typography variant="caption" component="p" sx={{ color: theme.palette.mode === 'dark' ? 'success.light' : 'success.dark', fontWeight: 600 }}>
              {q.type === 'essay' ? 'Model answer' : q.type === 'short-answer' ? 'Accepted answers' : 'Correct answer'}
            </Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <InlineCode text={key} />
            </Typography>
          </Box>
        )}
        {(r.feedback || explanation) && (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {r.feedback && <InlineCode text={r.feedback} />}
            {r.feedback && explanation ? ' ' : ''}
            {explanation && <InlineCode text={explanation} />}
          </Typography>
        )}
        {needsReview && (
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {isPractice ? 'This written answer has an approximate, automatic score.' : 'This written answer has a provisional score. Your instructor will confirm it.'}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default function Result() {
  const { submissionId } = useParams();
  const location = useLocation();
  const flash = location.state || {};
  const theme = useTheme();
  const { data, error, loading, reload } = useAsync(() => dedupe(`submission:${submissionId}`, () => getSubmission(submissionId)), [submissionId]);
  const [filter, setFilter] = useState('all');

  usePageTitle(data?.assessment?.title ? `${data.assessment.title}${data.attempt > 1 ? ` · attempt ${data.attempt}` : ''}` : null);

  const questions = useMemo(() => (Array.isArray(data?.questions) ? data.questions : []), [data]);

  const topics = useMemo(() => {
    // Server breakdown: canonical course topic names, weakest first.
    if (Array.isArray(data?.topicBreakdown)) {
      return data.topicBreakdown.map((t) => ({
        topic: t.topic,
        earned: Number(t.pointsEarned) || 0,
        max: Number(t.maxPoints) || 0,
        pct: Number(t.percentage) || 0,
      }));
    }
    // Older payloads: group the questions here.
    const map = new Map();
    questions.forEach((q) => {
      // Group case- and space-insensitively ("Queues" and "queues " are one topic).
      const name = String(q.topic || '').trim().replace(/\s+/g, ' ') || 'General';
      const key = name.toLowerCase();
      const cur = map.get(key) || { topic: name, earned: 0, max: 0, count: 0 };
      // Prefer the capitalised spelling (the course's canonical name) for display.
      if (cur.topic === cur.topic.toLowerCase() && name !== name.toLowerCase()) cur.topic = name;
      cur.earned += Number(q.result?.pointsEarned) || 0;
      cur.max += Number(q.result?.maxPoints ?? q.points) || 0;
      cur.count += 1;
      map.set(key, cur);
    });
    return Array.from(map.values())
      .map((t) => ({ ...t, pct: t.max ? (t.earned / t.max) * 100 : 0 }))
      .sort((a, b) => a.pct - b.pct);
  }, [data, questions]);

  const filtered = useMemo(() => {
    const withIndex = questions.map((q, i) => ({ q, i }));
    if (filter === 'incorrect') return withIndex.filter(({ q }) => !q.result?.isCorrect && !q.result?.needsReview);
    if (filter === 'review') return withIndex.filter(({ q }) => q.result?.needsReview);
    return withIndex;
  }, [questions, filter]);

  if (loading && !data) {
    return (
      <Container maxWidth="lg">
        <ResultSkeleton />
      </Container>
    );
  }

  if (error && !data) {
    return (
      <Container maxWidth="lg">
        <PageHeader title="Result" />
        <ErrorState
          error={error.status === 404 ? { message: "This result doesn't exist or isn't yours to view." } : error}
          title={error.status === 404 ? 'Result not found' : "We couldn't load this result"}
          onRetry={error.status === 404 ? null : reload}
          action={
            error.status === 404 ? (
              <Button variant="contained" component={RouterLink} to="/app/results">
                All results
              </Button>
            ) : null
          }
        />
      </Container>
    );
  }

  const a = data.assessment || {};
  const course = data.course || {};
  const isPractice = Boolean(a.isPractice);
  const courseLink = course.id ? `/app/courses/${course.id}` : '/app';
  const pathLink = course.id ? `/app/courses/${course.id}/learning-path` : null;
  const terminated = data.status === 'terminated' || data.integrity?.terminated;
  const violations = Number(data.integrity?.violationCount) || 0;
  const weakTopics = topics.filter((t) => t.pct < 80 && t.topic !== 'General').map((t) => t.topic);
  const practiceLink = pathLink ? `${pathLink}?practice=1${weakTopics.length ? `&topics=${encodeURIComponent(weakTopics.slice(0, 3).join('|'))}` : ''}` : null;

  const notices = (
    <>
      {flash.fromExam && !flash.alreadySubmitted && !flash.timeUp && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {flash.autoSubmitted ? 'Time ran out, so your answers were submitted automatically.' : 'Your answers were submitted.'}
        </Alert>
      )}
      {flash.timeUp && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Time was up, so your attempt was submitted with the answers saved before the deadline.
        </Alert>
      )}
      {flash.alreadySubmitted && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This attempt had already been submitted (for example from another device or when time ran out).
        </Alert>
      )}
      {flash.lateAnswersRejected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Your last changes arrived after the deadline, so only answers saved before time ran out were graded.
        </Alert>
      )}
      {terminated && (
        <Alert severity="error" icon={<GppMaybeOutlinedIcon />} sx={{ mb: 2 }}>
          This attempt was ended after {pluralize(violations, 'integrity warning')}. The answers given before that were graded.
        </Alert>
      )}
    </>
  );

  const header = (
    <PageHeader
      eyebrow={isPractice ? `Practice · ${course.title || ''}` : course.title}
      title={a.title || 'Result'}
      actions={
        <Button component={RouterLink} to={isPractice && pathLink ? pathLink : courseLink} startIcon={<ArrowBackRoundedIcon />} variant="outlined">
          {isPractice && pathLink ? 'Learning path' : 'Course'}
        </Button>
      }
    />
  );

  // ---- Not yet released --------------------------------------------------
  if (!data.released) {
    const copy =
      a.resultsPolicy === 'after-due'
        ? 'Scores for this assessment are shown after the due date, so everyone sees results at the same time.'
        : 'Your instructor will release results after reviewing the submissions. You will get a notification when they are ready.';
    return (
      <Container maxWidth="lg">
        {header}
        {notices}
        <Paper variant="outlined" sx={{ borderRadius: 5, p: { xs: 3, sm: 6 }, textAlign: 'center', mb: 3 }}>
          <Box
            aria-hidden="true"
            sx={{ width: 72, height: 72, mx: 'auto', mb: 2.5, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1), '& svg': { fontSize: 36 } }}
          >
            <MarkEmailReadOutlinedIcon />
          </Box>
          <Typography variant="h4" component="h2" sx={{ mb: 1 }}>
            Submitted — results aren't out yet
          </Typography>
          <Typography sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto' }}>{copy}</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(3, auto)' }, gap: 3, justifyContent: 'center', mt: 4 }}>
            <Meta label="Submitted" value={formatDateTime(data.submittedAt)} />
            <Meta label="Time spent" value={formatDuration(data.timeSpent)} />
            <Meta label="Attempt" value={data.attempt ?? '—'} />
          </Box>
          <Box sx={{ mt: 4, display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="contained" component={RouterLink} to={courseLink}>
              Back to course
            </Button>
            <Button variant="outlined" component={RouterLink} to="/app/results">
              All results
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  // ---- Released -----------------------------------------------------------
  const pct = Number(data.percentage) || 0;
  const passed = Boolean(data.isPassed);
  const showKey = questions.some((q) => q.correctAnswer !== undefined);
  const ai = data.aiFeedback && typeof data.aiFeedback === 'object' ? data.aiFeedback : null;
  const reviewCount = questions.filter((q) => q.result?.needsReview).length;
  const incorrectCount = questions.filter((q) => !q.result?.isCorrect && !q.result?.needsReview).length;

  return (
    <Container maxWidth="lg">
      {header}
      {notices}

      {/* Score hero */}
      <Paper variant="outlined" sx={{ borderRadius: 5, p: { xs: 2.5, sm: 4 }, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: { xs: 3, sm: 5 }, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' } }}>
          <ScoreRing value={pct} size={148} thickness={8} tone={passed ? 'success' : 'error'} label={formatPercent(pct, 1)} sublabel={passed ? 'passed' : 'not passed'} />
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', mb: 1, justifyContent: { xs: 'center', sm: 'flex-start' } }}>
              <ToneChip
                size="medium"
                tone={passed ? 'success' : 'error'}
                icon={passed ? <CheckCircleRoundedIcon /> : <CancelRoundedIcon />}
                label={passed ? 'Passed' : 'Not passed'}
              />
              {isPractice && <ToneChip size="medium" label="Practice — doesn't count" />}
              {data.needsReview && !isPractice && <ToneChip size="medium" tone="info" icon={<HourglassTopRoundedIcon />} label="Awaiting review" />}
            </Box>
            <Typography variant="h4" component="p" sx={{ fontVariantNumeric: 'tabular-nums', textAlign: { xs: 'center', sm: 'left' } }}>
              {data.score ?? 0} / {data.maxScore ?? a.totalPoints ?? 0} points
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 2.5, textAlign: { xs: 'center', sm: 'left' } }}>
              Pass mark {a.passingScore ?? 50}%{passed ? ' — well done.' : '. Review the questions below and practise your weak topics.'}
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0,1fr))', sm: 'repeat(4, minmax(0,1fr))' }, gap: 2 }}>
              <Meta label="Percentage" value={formatPercent(pct, 1)} />
              <Meta label="Time spent" value={formatDuration(data.timeSpent)} />
              <Meta label="Attempt" value={data.attempt ?? '—'} />
              <Meta label="Submitted" value={formatDateTime(data.submittedAt)} />
            </Box>
          </Box>
        </Box>
        {data.override && data.override.score != null && (
          <Alert severity="info" sx={{ mt: 3 }}>
            Your instructor adjusted the score{data.override.comment ? `: “${data.override.comment}”` : '.'}
          </Alert>
        )}
        {data.needsReview && isPractice && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Written answers in practice quizzes get an automatic, approximate score. Compare yours with the model answer below.
          </Alert>
        )}
        {data.needsReview && !isPractice && (
          <Alert severity="info" sx={{ mt: 2 }}>
            {pluralize(reviewCount, 'written answer')} {reviewCount === 1 ? 'has' : 'have'} a provisional score. Your final score may change after your instructor reviews {reviewCount === 1 ? 'it' : 'them'}.
          </Alert>
        )}
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) minmax(0, 1fr)' }, gap: 3, mb: 3 }}>
        {/* Topic breakdown */}
        <Section title="By topic">
          {topics.length ? (
            <Box component="ul" sx={{ p: 0, m: 0, display: 'grid', gap: 2 }}>
              {topics.map((t) => {
                const st = TOPIC_STATUS[topicStatusFor(t.pct)];
                return (
                  <Box component="li" key={t.topic} sx={{ listStyle: 'none' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.75 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 0 }} noWrap>
                        {t.topic}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums', flex: 'none' }}>
                        {Math.round(t.earned * 10) / 10}/{t.max} pts · {formatPercent(t.pct)}
                      </Typography>
                    </Box>
                    <ToneBar value={t.pct} tone={st.tone === 'default' ? 'primary' : st.tone} label={`${t.topic} ${Math.round(t.pct)} percent`} />
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              No topic information for this assessment.
            </Typography>
          )}
        </Section>

        {/* Next steps / feedback */}
        <Section
          title="What to do next"
          action={ai?.overallFeedback ? <ToneChip icon={<AutoAwesomeOutlinedIcon />} label="Automatic feedback" /> : null}
        >
          {ai?.overallFeedback && (
            <Typography sx={{ mb: 2 }}>
              <InlineCode text={ai.overallFeedback} />
            </Typography>
          )}
          {weakTopics.length > 0 ? (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Focus on <strong>{weakTopics.slice(0, 3).join(', ')}</strong> — {weakTopics.length === 1 ? 'it was' : 'these were'} your weakest
              {weakTopics.length === 1 ? ' topic' : ' topics'} here.
            </Typography>
          ) : (
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              You did well across every topic. Keep it up with your learning path.
            </Typography>
          )}
          {Array.isArray(ai?.studyRecommendations) && ai.studyRecommendations.length > 0 && (
            <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 2, color: 'text.secondary', '& li': { mb: 0.5 } }}>
              {ai.studyRecommendations.slice(0, 3).map((tip) => (
                <Typography component="li" variant="body2" key={tip}>
                  <InlineCode text={tip} />
                </Typography>
              ))}
            </Box>
          )}
          {pathLink && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {weakTopics.length > 0 && (
                <Button variant="contained" component={RouterLink} to={practiceLink} startIcon={<AutoAwesomeOutlinedIcon />}>
                  Practise weak topics
                </Button>
              )}
              <Button variant={weakTopics.length ? 'outlined' : 'contained'} component={RouterLink} to={pathLink} startIcon={<RouteRoundedIcon />}>
                Learning path
              </Button>
            </Box>
          )}
        </Section>
      </Box>

      {violations > 0 && !terminated && (
        <Alert severity="warning" icon={<GppMaybeOutlinedIcon />} sx={{ mb: 3 }}>
          {pluralize(violations, 'integrity warning')} {violations === 1 ? 'was' : 'were'} recorded during this attempt (for example leaving full screen or switching tabs). Your instructor can see them.
        </Alert>
      )}

      {/* Per-question review */}
      <Section
        title={`Question review (${questions.length})`}
        action={
          questions.length > 0 && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={filter}
              onChange={(_e, v) => v && setFilter(v)}
              aria-label="Filter questions"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="incorrect" disabled={!incorrectCount}>
                Missed ({incorrectCount})
              </ToggleButton>
              {reviewCount > 0 && <ToggleButton value="review">Review ({reviewCount})</ToggleButton>}
            </ToggleButtonGroup>
          )
        }
      >
        {!showKey && questions.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
            Your instructor has chosen not to show the correct answers for this assessment.
          </Typography>
        )}
        {filtered.length ? (
          <Box component="ol" sx={{ p: 0, m: 0, display: 'grid', gap: 1.5 }}>
            {filtered.map(({ q, i }) => (
              <QuestionReview key={q.id || i} q={q} index={i} showKey={showKey} isPractice={isPractice} />
            ))}
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {questions.length ? 'Nothing matches this filter.' : 'No question details are available.'}
          </Typography>
        )}
      </Section>
    </Container>
  );
}
