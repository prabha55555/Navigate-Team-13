import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import EventBusyRoundedIcon from '@mui/icons-material/EventBusyRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import GppBadOutlinedIcon from '@mui/icons-material/GppBadOutlined';
import KeyboardRoundedIcon from '@mui/icons-material/KeyboardRounded';
import LockClockRoundedIcon from '@mui/icons-material/LockClockRounded';
import TabRoundedIcon from '@mui/icons-material/TabRounded';
import VideocamRoundedIcon from '@mui/icons-material/VideocamRounded';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Skeleton,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { getAssessment, startAttempt } from '../../api/assessments';
import BrandMark from '../../components/common/BrandMark';
import InlineCode from '../../components/common/InlineCode';
import ExamRunner from '../../components/learner/ExamRunner';
import { enterFullscreen, exitFullscreen, fullscreenSupported } from '../../components/learner/examKit';
import { REASON_COPY, formatDateTime, pluralize } from '../../components/learner/format';
import ProctoringWebcam from '../../components/learner/ProctoringWebcam';
import { readUnsavedBackup } from '../../components/learner/useAutosave';

const RESULTS_COPY = {
  immediate: 'You will see your score as soon as you submit.',
  'after-due': 'Scores are shown after the due date.',
  manual: 'Your instructor will release scores after reviewing.',
};

/** Normalises stored answers into what the inputs expect (strings / string arrays). */
const normaliseAnswers = (answers) => {
  const out = {};
  Object.entries(answers || {}).forEach(([qid, v]) => {
    if (typeof v === 'boolean') out[qid] = v ? 'True' : 'False';
    else if (Array.isArray(v)) out[qid] = v.map(String);
    else if (v == null) out[qid] = v;
    else out[qid] = String(v);
  });
  return out;
};

// ---------------------------------------------------------------------------
// Focused layout chrome (this page renders outside the app shell)
// ---------------------------------------------------------------------------
const FocusLayout = ({ children, backTo, backLabel = 'Back' }) => (
  <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
    <Box
      component="header"
      sx={{ maxWidth: 880, mx: 'auto', px: { xs: 2, sm: 3 }, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <BrandMark size={28} withWordmark title="Navigate" />
      {backTo && (
        <Button component={RouterLink} to={backTo} startIcon={<ArrowBackRoundedIcon />} color="inherit" sx={{ color: 'text.secondary' }}>
          {backLabel}
        </Button>
      )}
    </Box>
    <Box component="main" sx={{ maxWidth: 880, mx: 'auto', px: { xs: 2, sm: 3 }, pb: 8, pt: { xs: 1, sm: 3 } }}>
      {children}
    </Box>
  </Box>
);

const OutcomeCard = ({ icon, tone = 'primary', title, children, actions }) => {
  const theme = useTheme();
  const pal = theme.palette[tone] || theme.palette.primary;
  return (
    <Paper variant="outlined" sx={{ borderRadius: 5, p: { xs: 3, sm: 6 }, textAlign: 'center' }}>
      <Box
        aria-hidden="true"
        sx={{
          width: 72,
          height: 72,
          mx: 'auto',
          mb: 2.5,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: pal.main,
          bgcolor: alpha(pal.main, 0.12),
          '& svg': { fontSize: 36 },
        }}
      >
        {icon}
      </Box>
      <Typography variant="h4" component="h1" sx={{ mb: 1.5 }}>
        {title}
      </Typography>
      <Box sx={{ color: 'text.secondary', maxWidth: 520, mx: 'auto', '& p': { m: 0, mb: 1 } }}>{children}</Box>
      {actions && <Box sx={{ mt: 3.5, display: 'flex', gap: 1.5, justifyContent: 'center', flexWrap: 'wrap' }}>{actions}</Box>}
    </Paper>
  );
};

const BLOCKED_ICON = {
  closed: <BlockRoundedIcon />,
  'not-yet-available': <EventAvailableRoundedIcon />,
  'past-due': <EventBusyRoundedIcon />,
  'no-attempts-left': <LockClockRoundedIcon />,
};

const BlockedScreen = ({ reason, meta, message }) => {
  const courseLink = meta?.isPractice || !meta?.courseId ? '/app' : `/app/courses/${meta.courseId}`;
  const last = meta?.myStatus?.lastSubmissionId;
  let body;
  switch (reason) {
    case 'not-yet-available':
      body = `This assessment opens ${meta?.availableFrom ? formatDateTime(meta.availableFrom) : 'soon'}. Come back then — nothing is lost.`;
      break;
    case 'past-due':
      body = `The due date (${formatDateTime(meta?.dueDate)}) has passed, so new attempts can't be started. Contact your instructor if you think this is a mistake.`;
      break;
    case 'no-attempts-left':
      body = `You've used all ${pluralize(meta?.maxAttempts || meta?.myStatus?.attempts || 1, 'attempt')} for this assessment.`;
      break;
    case 'closed':
      body = 'Your instructor has closed this assessment, so it no longer accepts attempts.';
      break;
    default:
      body = message || "This assessment can't be started right now.";
  }
  return (
    <OutcomeCard
      icon={BLOCKED_ICON[reason] || <BlockRoundedIcon />}
      tone={reason === 'not-yet-available' ? 'info' : 'warning'}
      title={REASON_COPY[reason]?.title || "This assessment isn't available"}
      actions={
        <>
          {last && (
            <Button variant="contained" component={RouterLink} to={`/app/results/${last}`}>
              View my result
            </Button>
          )}
          <Button variant={last ? 'outlined' : 'contained'} component={RouterLink} to={courseLink}>
            {courseLink === '/app' ? 'Back to dashboard' : 'Back to course'}
          </Button>
        </>
      }
    >
      <Typography component="p">{body}</Typography>
    </OutcomeCard>
  );
};

// ---------------------------------------------------------------------------
// Pre-start screen
// ---------------------------------------------------------------------------
const Fact = ({ label, value }) => (
  <Box sx={{ p: 2, borderRadius: 3, bgcolor: 'action.hover', minWidth: 0 }}>
    <Typography variant="caption" component="p" sx={{ color: 'text.secondary', fontWeight: 600, mb: 0.25 }}>
      {label}
    </Typography>
    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{value}</Typography>
  </Box>
);

const Rule = ({ icon, title, children }) => (
  <Box component="li" sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
    <Box sx={{ color: 'primary.main', mt: 0.25, flex: 'none', '& svg': { fontSize: 22 } }} aria-hidden="true">
      {icon}
    </Box>
    <Box>
      <Typography sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {children}
      </Typography>
    </Box>
  </Box>
);

const CAMERA_COPY = {
  starting: { label: 'Checking your camera…', severity: 'info' },
  live: { label: 'Camera is working.', severity: 'success' },
  blocked: { label: 'We could not access your camera. Allow camera access in your browser, then retry.', severity: 'error' },
  interrupted: { label: 'Your camera feed stopped. Check the connection, then retry.', severity: 'error' },
};

const PreStart = ({ meta, onStart, starting, startError }) => {
  const proctor = meta.proctoring || {};
  const proctored = !meta.isPractice && Boolean(proctor.enabled);
  const needsFullscreen = proctored && proctor.fullscreen;
  const fsSupported = fullscreenSupported();
  const needsCamera = proctored && proctor.webcam;
  const resuming = meta.myStatus?.reason === 'in-progress' || Boolean(meta.myStatus?.inProgress || meta.myStatus?.inProgressSubmissionId);
  // Resuming an attempt the student already agreed to doesn't ask again.
  const [agreed, setAgreed] = useState(Boolean(meta.isPractice) || resuming);
  const [cameraStatus, setCameraStatus] = useState('starting');
  const [cameraKey, setCameraKey] = useState(0);
  const attemptsUsed = Number(meta.myStatus?.attempts) || 0;
  const maxAttempts = Number(meta.maxAttempts) || 1;
  // myStatus.attempts counts finished attempts only, so an in-progress one is attemptsUsed + 1 too.
  const attemptNo = attemptsUsed + 1;

  const cameraOk = !needsCamera || cameraStatus === 'live';
  const canStart = agreed && cameraOk && !starting && (meta.questionCount ?? 1) > 0;

  return (
    <Box>
      <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
        {meta.isPractice ? 'Practice quiz' : meta.courseTitle}
      </Typography>
      <Typography variant="h3" component="h1" sx={{ mb: 1.5 }}>
        {meta.title}
      </Typography>
      {meta.description && (
        <Typography sx={{ color: 'text.secondary', mb: 3, fontSize: '1.05rem', whiteSpace: 'pre-wrap' }}>
          <InlineCode text={meta.description} />
        </Typography>
      )}

      {resuming && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have an attempt in progress. Your saved answers will be restored
          {meta.timeLimit ? ' — the timer kept running while you were away' : ''}.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 3 }}>
        <Fact label="Questions" value={meta.questionCount ?? '—'} />
        <Fact label="Time limit" value={meta.timeLimit ? `${meta.timeLimit} min` : 'None'} />
        <Fact label="Attempt" value={meta.isPractice ? `${attemptNo}` : `${attemptNo} of ${maxAttempts}`} />
        <Fact label="Pass mark" value={`${meta.passingScore ?? 50}%`} />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 4, p: { xs: 2.5, sm: 3 }, mb: 3 }}>
        <Typography variant="h6" component="h2" sx={{ mb: 2, fontSize: '1.05rem' }}>
          Before you begin
        </Typography>
        {meta.instructions && (
          <Typography sx={{ mb: 2, whiteSpace: 'pre-wrap' }}>
            <InlineCode text={meta.instructions} />
          </Typography>
        )}
        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gap: 2 }}>
          <Rule icon={<LockClockRoundedIcon />} title={meta.timeLimit ? `${meta.timeLimit} minutes once you start` : 'No time limit'}>
            {meta.timeLimit
              ? 'The timer runs on our server, so it keeps going if you close the tab. When time is up your answers are submitted automatically.'
              : 'Take the time you need.'}
            {meta.dueDate ? ` Due ${formatDateTime(meta.dueDate)}.${meta.timeLimit ? ' The attempt also ends at the due date.' : ''}` : ''}
          </Rule>
          <Rule icon={<EventAvailableRoundedIcon />} title="Your answers save automatically">
            You can close the tab or switch devices and resume where you left off. {RESULTS_COPY[meta.resultsPolicy] || ''}
          </Rule>
          {needsFullscreen && (
            <Rule icon={<FullscreenRoundedIcon />} title="Full screen is required">
              {fsSupported
                ? 'The assessment opens in full screen. Leaving full screen (for example with Esc) is recorded as an integrity warning.'
                : "Your browser doesn't support full screen, so this rule is skipped on this device."}
            </Rule>
          )}
          {proctored && (
            <Rule icon={<TabRoundedIcon />} title="Stay on this page">
              Switching tabs or windows is recorded as an integrity warning.
            </Rule>
          )}
          {proctored && proctor.blockShortcuts && (
            <Rule icon={<KeyboardRoundedIcon />} title="Copy, paste and shortcuts are disabled">
              Using copy/paste or reload shortcuts is blocked and recorded.
            </Rule>
          )}
          {needsCamera && (
            <Rule icon={<VideocamRoundedIcon />} title="Camera on">
              Keep your camera on for the whole attempt. The video stays on your device; only interruptions are recorded.
            </Rule>
          )}
          {proctored && (
            <Rule icon={<GppBadOutlinedIcon />} title={`${proctor.maxViolations || 5} warnings end the attempt`}>
              At {proctor.maxViolations || 5} integrity warnings your attempt is submitted automatically with the answers you have so far.
            </Rule>
          )}
        </Box>
      </Paper>

      {needsCamera && (
        <Paper variant="outlined" sx={{ borderRadius: 4, p: { xs: 2.5, sm: 3 }, mb: 3 }}>
          <Typography variant="h6" component="h2" sx={{ mb: 2, fontSize: '1.05rem' }}>
            Camera check
          </Typography>
          <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' } }}>
            <ProctoringWebcam key={cameraKey} variant="inline" onStatus={setCameraStatus} />
            <Box sx={{ flex: 1 }}>
              <Alert severity={CAMERA_COPY[cameraStatus]?.severity || 'info'} sx={{ mb: 1.5 }} role="status">
                {CAMERA_COPY[cameraStatus]?.label}
              </Alert>
              {(cameraStatus === 'blocked' || cameraStatus === 'interrupted') && (
                <Button variant="outlined" onClick={() => setCameraKey((k) => k + 1)}>
                  Retry camera
                </Button>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {startError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {startError}
        </Alert>
      )}

      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', sm: 'row' },
          alignItems: { xs: 'stretch', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        {!meta.isPractice && !resuming ? (
          <FormControlLabel
            control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
            label="I've read the rules and will complete this assessment on my own."
            sx={{ mr: 0 }}
          />
        ) : (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {resuming ? 'You already agreed to the rules for this attempt.' : 'Practice quizzes never count towards your grade.'}
          </Typography>
        )}
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          disabled={!canStart}
          startIcon={starting ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ px: 4, flex: 'none' }}
        >
          {starting ? 'Preparing…' : resuming ? 'Resume attempt' : meta.isPractice ? 'Start practice' : 'Start assessment'}
        </Button>
      </Box>
      {needsCamera && !cameraOk && agreed && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1, textAlign: { sm: 'right' } }}>
          The camera check must pass before you can start.
        </Typography>
      )}
    </Box>
  );
};

const PreStartSkeleton = () => (
  <Box aria-busy="true" aria-label="Loading assessment">
    <Skeleton width={160} height={20} />
    <Skeleton width="70%" height={56} sx={{ mb: 1 }} />
    <Skeleton width="90%" />
    <Skeleton width="60%" sx={{ mb: 3 }} />
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1.5, mb: 3 }}>
      {[0, 1, 2, 3].map((i) => (
        <Skeleton key={i} variant="rounded" height={72} />
      ))}
    </Box>
    <Skeleton variant="rounded" height={260} sx={{ borderRadius: 4 }} />
  </Box>
);

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TakeAssessment() {
  const { assessmentId } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState({ loading: true, error: null, data: null });
  const [phase, setPhase] = useState('intro'); // intro | exam | blocked | terminated
  const [blocked, setBlocked] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState(null);
  const [session, setSession] = useState(null);
  const [terminated, setTerminated] = useState(null);

  const load = useCallback(() => {
    let cancelled = false;
    setMeta((m) => ({ ...m, loading: true, error: null }));
    getAssessment(assessmentId)
      .then((data) => {
        if (cancelled) return;
        setMeta({ loading: false, error: null, data });
        const status = data.myStatus || {};
        if (!status.canStart && status.reason && status.reason !== 'in-progress') {
          setBlocked({ reason: status.reason });
          setPhase('blocked');
        }
      })
      .catch((error) => {
        if (!cancelled) setMeta({ loading: false, error, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, [assessmentId]);

  useEffect(() => load(), [load]);

  useEffect(() => {
    document.title = meta.data?.title ? `${meta.data.title} · Navigate` : 'Assessment · Navigate';
  }, [meta.data]);

  const handleStart = async () => {
    if (starting) return;
    setStarting(true);
    setStartError(null);
    const proctor = meta.data?.proctoring || {};
    // Full screen must be requested inside the click; refusals are handled in the exam
    // (a "Return to full screen" prompt, not counted as a warning).
    if (!meta.data?.isPractice && proctor.enabled && proctor.fullscreen && fullscreenSupported()) {
      enterFullscreen().catch(() => {});
    }
    try {
      const { submission, assessment } = await startAttempt(assessmentId);
      const offset = submission.serverNow ? new Date(submission.serverNow).getTime() - Date.now() : 0;
      const endTime = submission.deadlineAt ? new Date(submission.deadlineAt).getTime() - offset : null;
      const serverAnswers = normaliseAnswers(submission.answers);
      const backup = readUnsavedBackup(submission.id);
      const validIds = new Set(assessment.questions.map((q) => q.id));
      const restoredIds = backup ? Object.keys(backup).filter((qid) => validIds.has(qid)) : [];
      const initialAnswers = { ...serverAnswers };
      restoredIds.forEach((qid) => {
        initialAnswers[qid] = normaliseAnswers({ [qid]: backup[qid] })[qid];
      });
      setSession({
        submission,
        assessment: { ...assessment, courseTitle: assessment.courseTitle || meta.data?.courseTitle },
        endTime,
        initialAnswers,
        restoredIds,
      });
      setPhase('exam');
    } catch (err) {
      exitFullscreen();
      const reason = err?.details?.reason;
      if (err?.status === 409 && reason) {
        setBlocked({ reason, message: err.message });
        setPhase('blocked');
      } else {
        setStartError(err?.message || 'Could not start the assessment. Please try again.');
      }
    } finally {
      setStarting(false);
    }
  };

  const handleTerminated = useCallback((info) => {
    setTerminated(info);
    setPhase('terminated');
  }, []);

  const data = meta.data;
  const backTo = data?.isPractice || !data?.courseId ? '/app' : `/app/courses/${data.courseId}`;

  if (phase === 'exam' && session) {
    return <ExamRunner session={session} onTerminated={handleTerminated} />;
  }

  if (phase === 'terminated' && terminated) {
    return (
      <FocusLayout>
        <OutcomeCard
          icon={<GppBadOutlinedIcon />}
          tone="error"
          title="Your attempt was ended"
          actions={
            <>
              <Button variant="contained" onClick={() => navigate(`/app/results/${terminated.submissionId}`, { replace: true })}>
                View submission
              </Button>
              <Button variant="outlined" component={RouterLink} to={backTo} replace>
                Back to {backTo === '/app' ? 'dashboard' : 'course'}
              </Button>
            </>
          }
        >
          <Typography component="p">
            You reached {terminated.violationCount ?? terminated.maxViolations} of {terminated.maxViolations} integrity warnings, the limit set by your
            instructor.
          </Typography>
          <Typography component="p">
            The answers you gave before that were submitted and will be graded. Your instructor can see what was recorded and may follow up with
            you.
          </Typography>
        </OutcomeCard>
      </FocusLayout>
    );
  }

  if (meta.loading) {
    return (
      <FocusLayout backTo="/app">
        <PreStartSkeleton />
      </FocusLayout>
    );
  }

  if (meta.error) {
    const notFound = meta.error.status === 404 || meta.error.status === 403;
    return (
      <FocusLayout backTo="/app" backLabel="Dashboard">
        <OutcomeCard
          icon={<BlockRoundedIcon />}
          tone={notFound ? 'warning' : 'error'}
          title={notFound ? 'Assessment not found' : "We couldn't load this assessment"}
          actions={
            notFound ? (
              <Button variant="contained" component={RouterLink} to="/app">
                Back to dashboard
              </Button>
            ) : (
              <Button variant="contained" onClick={load}>
                Retry
              </Button>
            )
          }
        >
          <Typography component="p">
            {notFound
              ? "It may have been removed, or it isn't part of a course you're enrolled in."
              : meta.error.message}
          </Typography>
        </OutcomeCard>
      </FocusLayout>
    );
  }

  if (phase === 'blocked' && blocked) {
    return (
      <FocusLayout backTo={backTo}>
        <BlockedScreen reason={blocked.reason} message={blocked.message} meta={data} />
      </FocusLayout>
    );
  }

  return (
    <FocusLayout backTo={backTo} backLabel={backTo === '/app' ? 'Dashboard' : 'Course'}>
      <PreStart meta={data} onStart={handleStart} starting={starting} startError={startError} />
    </FocusLayout>
  );
}
