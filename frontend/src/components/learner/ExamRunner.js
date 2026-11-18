import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffRoundedIcon from '@mui/icons-material/CloudOffRounded';
import CloudSyncOutlinedIcon from '@mui/icons-material/CloudSyncOutlined';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import FullscreenRoundedIcon from '@mui/icons-material/FullscreenRounded';
import GppMaybeOutlinedIcon from '@mui/icons-material/GppMaybeOutlined';
import GridViewRoundedIcon from '@mui/icons-material/GridViewRounded';
import VideocamOffRoundedIcon from '@mui/icons-material/VideocamOffRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportIntegrityEvent, submitSubmission } from '../../api/submissions';
import { useNotify } from '../../contexts/NotificationContext';
import BrandMark from '../common/BrandMark';
import {
  BLOCKED_COMBO_CODES,
  BLOCKED_COMBO_KEYS,
  ExamCountdown,
  FULLSCREEN_EVENTS,
  enterFullscreen,
  exitFullscreen,
  fullscreenSupported,
  getFullscreenElement,
  isTypingTarget,
} from './examKit';
import { formatDateTime, isAnswered, pluralize } from './format';
import ProctoringWebcam from './ProctoringWebcam';
import QuestionView from './QuestionView';
import useAutosave from './useAutosave';

// ---------------------------------------------------------------------------
// Small per-attempt UI state (flags, position) kept locally so a reload resumes it.
// ---------------------------------------------------------------------------
const uiKey = (submissionId) => `navigate:exam-ui:${submissionId}`;
export const readExamUi = (submissionId) => {
  try {
    const v = JSON.parse(localStorage.getItem(uiKey(submissionId)));
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
};
const writeExamUi = (submissionId, value) => {
  try {
    localStorage.setItem(uiKey(submissionId), JSON.stringify(value));
  } catch {
    /* ignore */
  }
};
export const clearExamUi = (submissionId) => {
  try {
    localStorage.removeItem(uiKey(submissionId));
  } catch {
    /* ignore */
  }
};

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------
const SAVE_COPY = {
  idle: { label: 'Autosave on', icon: CloudDoneOutlinedIcon, tone: 'text.secondary' },
  pending: { label: 'Unsaved changes', icon: CloudSyncOutlinedIcon, tone: 'text.secondary' },
  saving: { label: 'Saving…', icon: null, tone: 'text.secondary' },
  saved: { label: 'Saved', icon: CheckCircleRoundedIcon, tone: 'success.main' },
  offline: { label: 'Offline — will retry', icon: CloudOffRoundedIcon, tone: 'warning.main' },
  error: { label: "Couldn't save — retrying", icon: CloudOffRoundedIcon, tone: 'warning.main' },
};

const SaveIndicator = memo(({ status, savedAt, compact }) => {
  const copy = SAVE_COPY[status] || SAVE_COPY.idle;
  const Icon = copy.icon;
  const tip = status === 'saved' && savedAt ? `Last saved ${formatDateTime(savedAt)}` : copy.label;
  return (
    <Tooltip title={tip}>
      <Box
        role="status"
        aria-live="polite"
        aria-label={copy.label}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, color: copy.tone, fontSize: '0.85rem', fontWeight: 600, whiteSpace: 'nowrap' }}
      >
        {Icon ? <Icon sx={{ fontSize: 18 }} aria-hidden="true" /> : <CircularProgress size={14} thickness={5} color="inherit" aria-hidden="true" />}
        {!compact && <span>{copy.label}</span>}
      </Box>
    </Tooltip>
  );
});

// ---------------------------------------------------------------------------
// Question navigator
// ---------------------------------------------------------------------------
const Navigator = memo(({ questions, answers, flags, current, onJump }) => {
  const theme = useTheme();
  const answeredCount = questions.reduce((n, q) => n + (isAnswered(answers[q.id]) ? 1 : 0), 0);
  return (
    <Box component="nav" aria-label="Question navigator">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
        <Typography variant="subtitle2" component="h2">
          Questions
        </Typography>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontVariantNumeric: 'tabular-nums' }}>
          {answeredCount}/{questions.length} answered
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 1 }}>
        {questions.map((q, i) => {
          const answered = isAnswered(answers[q.id]);
          const flagged = flags.has(q.id);
          const isCurrent = i === current;
          const state = [answered ? 'answered' : 'not answered', flagged ? 'flagged' : null, isCurrent ? 'current' : null]
            .filter(Boolean)
            .join(', ');
          return (
            <Box
              key={q.id}
              component="button"
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}, ${state}`}
              aria-current={isCurrent ? 'step' : undefined}
              sx={{
                position: 'relative',
                height: 42,
                borderRadius: 2,
                font: 'inherit',
                fontWeight: 700,
                fontSize: '0.9rem',
                fontVariantNumeric: 'tabular-nums',
                cursor: 'pointer',
                border: '1px solid',
                transition: 'background-color .15s ease, border-color .15s ease',
                borderColor: isCurrent ? 'primary.main' : answered ? alpha(theme.palette.success.main, 0.45) : 'divider',
                color: isCurrent ? 'primary.contrastText' : answered ? (theme.palette.mode === 'dark' ? 'success.light' : 'success.dark') : 'text.primary',
                bgcolor: isCurrent ? 'primary.main' : answered ? alpha(theme.palette.success.main, 0.12) : 'background.paper',
                '&:hover': { borderColor: isCurrent ? 'primary.dark' : 'text.secondary' },
                '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 },
              }}
            >
              {i + 1}
              {flagged && (
                <FlagRoundedIcon
                  aria-hidden="true"
                  sx={{
                    position: 'absolute',
                    top: -7,
                    right: -6,
                    fontSize: 16,
                    color: 'secondary.main',
                    filter: `drop-shadow(0 0 1px ${theme.palette.background.paper})`,
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1.5, color: 'text.secondary' }}>
        {[
          { label: 'Current', sx: { bgcolor: 'primary.main' } },
          { label: 'Answered', sx: { bgcolor: alpha(theme.palette.success.main, 0.2), border: `1px solid ${alpha(theme.palette.success.main, 0.45)}` } },
          { label: 'Not answered', sx: { border: `1px solid ${theme.palette.divider}` } },
        ].map((item) => (
          <Box component="li" key={item.label} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: '0.75rem' }}>
            <Box aria-hidden="true" sx={{ width: 12, height: 12, borderRadius: 0.75, ...item.sx }} />
            {item.label}
          </Box>
        ))}
        <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}>
          <FlagRoundedIcon aria-hidden="true" sx={{ fontSize: 14, color: 'secondary.main' }} />
          Flagged
        </Box>
      </Box>
    </Box>
  );
});

// ---------------------------------------------------------------------------
// The exam itself
// ---------------------------------------------------------------------------
/**
 * session: { submission, assessment, endTime (client ms or null), initialAnswers, restoredIds }
 * onTerminated({ submissionId, violationCount, maxViolations })
 */
export default function ExamRunner({ session, onTerminated }) {
  const { submission, assessment, endTime, initialAnswers, restoredIds } = session;
  const submissionId = submission.id;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const notify = useNotify();

  const questions = assessment.questions;
  const proctor = assessment.proctoring || {};
  const proctored = !assessment.isPractice && Boolean(proctor.enabled);
  const rules = useMemo(
    () => ({
      fullscreen: proctored && Boolean(proctor.fullscreen) && fullscreenSupported(),
      webcam: proctored && Boolean(proctor.webcam),
      shortcuts: proctored && Boolean(proctor.blockShortcuts),
      tab: proctored,
    }),
    [proctored, proctor.fullscreen, proctor.webcam, proctor.blockShortcuts]
  );
  const maxViolations = Number(proctor.maxViolations) || 5;

  const savedUi = useMemo(() => readExamUi(submissionId), [submissionId]);
  const [answers, setAnswers] = useState(initialAnswers);
  const answersRef = useRef(initialAnswers);
  const [index, setIndex] = useState(() => Math.min(Math.max(0, Number(savedUi.index) || 0), Math.max(0, questions.length - 1)));
  const [flags, setFlags] = useState(() => new Set(Array.isArray(savedUi.flags) ? savedUi.flags : []));
  const [violations, setViolations] = useState(Number(submission.violationCount) || 0);
  const [isFullscreen, setIsFullscreen] = useState(() => Boolean(getFullscreenElement()));
  const [cameraLost, setCameraLost] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [submitState, setSubmitState] = useState({ submitting: false, error: null, auto: false });
  const [timeWarning, setTimeWarning] = useState(null);

  // Refs read from event handlers and timers so they always see current values.
  const activeRef = useRef(true);
  const submittingRef = useRef(false);
  const wasFullscreenRef = useRef(Boolean(getFullscreenElement()));
  const lastViolationAtRef = useRef(0);
  const unloadingRef = useRef(false);
  const pendingEventsRef = useRef([]);
  const questionTopRef = useRef(null);
  const indexRef = useRef(index);
  const finishedRef = useRef(false);
  const exitTimerRef = useRef(null);

  // ---- finishing ---------------------------------------------------------
  const finish = useCallback(
    (state) => {
      activeRef.current = false;
      finishedRef.current = true;
      clearExamUi(submissionId);
      exitFullscreen();
      navigate(`/app/results/${submissionId}`, { replace: true, state });
    },
    [navigate, submissionId]
  );

  const handleConflict = useCallback(
    (err) => {
      // The server already finished this attempt (time is up, terminated, or submitted on another device).
      if (submittingRef.current || !activeRef.current) return;
      const reason = err?.details?.reason;
      finish({ fromExam: true, timeUp: reason === 'deadline-passed', alreadySubmitted: reason !== 'deadline-passed' });
    },
    [finish]
  );

  const autosave = useAutosave(submissionId, answersRef, { onConflict: handleConflict });
  const { markDirty, markAllDirty, flush, stop: stopAutosave } = autosave;

  // Answers restored from this device's unsaved backup get sent to the server.
  useEffect(() => {
    if (restoredIds && restoredIds.length) {
      markAllDirty(restoredIds);
      notify('Restored answers that had not been saved yet.', 'info');
    }
  }, [restoredIds, markAllDirty, notify]);

  useEffect(() => {
    writeExamUi(submissionId, { index, flags: Array.from(flags) });
  }, [submissionId, index, flags]);

  // (Re)activate on mount — React StrictMode runs mount → unmount → mount in development.
  // Leaving full screen is deferred a tick so that StrictMode's simulated unmount doesn't drop it.
  useEffect(() => {
    activeRef.current = !finishedRef.current;
    clearTimeout(exitTimerRef.current);
    return () => {
      activeRef.current = false;
      exitTimerRef.current = setTimeout(exitFullscreen, 0);
    };
  }, []);

  // ---- integrity events ---------------------------------------------------
  const handleTerminated = useCallback(
    (count) => {
      if (!activeRef.current) return;
      activeRef.current = false;
      finishedRef.current = true;
      stopAutosave({ clearBackup: true });
      clearExamUi(submissionId);
      exitFullscreen();
      onTerminated({ submissionId, violationCount: count, maxViolations });
    },
    [stopAutosave, submissionId, onTerminated, maxViolations]
  );

  const sendEvent = useCallback(
    async (event) => {
      try {
        const res = await reportIntegrityEvent(submissionId, event);
        if (typeof res?.violationCount === 'number') setViolations(res.violationCount);
        if (res?.terminated) handleTerminated(res.violationCount);
        return true;
      } catch (err) {
        if (err?.status === 409) {
          handleConflict(err);
          return true;
        }
        return false;
      }
    },
    [submissionId, handleTerminated, handleConflict]
  );

  /** Report an integrity event. `dedupe` merges events that one action fires together (e.g. tab switch + leaving full screen). */
  const report = useCallback(
    async (type, detail, { dedupe = false } = {}) => {
      if (!activeRef.current || submittingRef.current || unloadingRef.current) return;
      const now = Date.now();
      if (dedupe && now - lastViolationAtRef.current < 1500) return;
      if (dedupe) lastViolationAtRef.current = now;
      if (dedupe) {
        // Leaving full screen / hiding the page also happens when the student reloads or closes
        // the tab (the attempt resumes, as promised on the rules screen). Wait a moment and drop
        // the event if the page is unloading.
        await new Promise((resolve) => setTimeout(resolve, 400));
        if (unloadingRef.current || !activeRef.current || submittingRef.current) {
          lastViolationAtRef.current = 0;
          return;
        }
      }
      setViolations((v) => v + 1); // optimistic; the server count replaces it
      const ok = await sendEvent({ type, detail });
      if (!ok) pendingEventsRef.current.push({ type, detail });
    },
    [sendEvent]
  );

  // Track reload / close so the resulting fullscreen exit and visibility change aren't violations.
  useEffect(() => {
    let resetTimer = null;
    const onLeaving = () => {
      unloadingRef.current = true;
      clearTimeout(resetTimer);
      // If the student cancels the "leave page?" prompt the page stays: re-arm after a moment.
      resetTimer = setTimeout(() => {
        unloadingRef.current = false;
      }, 3000);
    };
    window.addEventListener('beforeunload', onLeaving);
    window.addEventListener('pagehide', onLeaving);
    return () => {
      clearTimeout(resetTimer);
      window.removeEventListener('beforeunload', onLeaving);
      window.removeEventListener('pagehide', onLeaving);
    };
  }, []);

  // Re-send events that failed while offline.
  useEffect(() => {
    const retry = async () => {
      const queue = pendingEventsRef.current.splice(0);
      for (const ev of queue) {
        if (!activeRef.current) return;
        // eslint-disable-next-line no-await-in-loop
        const ok = await sendEvent(ev);
        if (!ok) pendingEventsRef.current.push(ev);
      }
    };
    window.addEventListener('online', retry);
    const id = setInterval(() => pendingEventsRef.current.length && retry(), 15000);
    return () => {
      window.removeEventListener('online', retry);
      clearInterval(id);
    };
  }, [sendEvent]);

  // Full screen: only a real fullscreen -> windowed transition counts, so duplicate
  // (prefixed + unprefixed) events can't double count.
  useEffect(() => {
    if (!rules.fullscreen) return undefined;
    const onChange = () => {
      const fs = Boolean(getFullscreenElement());
      if (fs === wasFullscreenRef.current) return;
      wasFullscreenRef.current = fs;
      setIsFullscreen(fs);
      if (!fs) report('fullscreen_exit', 'Left full screen', { dedupe: true });
    };
    FULLSCREEN_EVENTS.forEach((name) => document.addEventListener(name, onChange));
    return () => FULLSCREEN_EVENTS.forEach((name) => document.removeEventListener(name, onChange));
  }, [rules.fullscreen, report]);

  // Switching tabs / minimising.
  useEffect(() => {
    if (!rules.tab) return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report('tab_hidden', 'Switched away from the assessment', { dedupe: true });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [rules.tab, report]);

  // Blocked shortcuts (copy/paste/cut/reload, the OS key).
  useEffect(() => {
    if (!rules.shortcuts) return undefined;
    const onKeyDown = (e) => {
      const key = (e.key || '').toLowerCase();
      const isBlockedCombo = (e.ctrlKey || e.metaKey) && (BLOCKED_COMBO_KEYS.has(key) || BLOCKED_COMBO_CODES.has(e.code));
      const isBlockedKey = e.key === 'F5' || e.key === 'Meta' || e.key === 'OS';
      if (!isBlockedCombo && !isBlockedKey) return;
      e.preventDefault();
      // Holding a key auto-repeats keydown; count each press once. A Cmd+<key> combo was
      // already counted when Cmd (Meta) itself went down.
      if (e.repeat || (isBlockedCombo && !e.ctrlKey && !isBlockedKey)) return;
      report('blocked_shortcut', isBlockedKey ? e.key : `${e.ctrlKey ? 'Ctrl' : 'Cmd'}+${key.toUpperCase()}`);
    };
    const prevent = (e) => e.preventDefault();
    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', prevent);
    document.addEventListener('copy', prevent);
    document.addEventListener('cut', prevent);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', prevent);
      document.removeEventListener('copy', prevent);
      document.removeEventListener('cut', prevent);
    };
  }, [rules.shortcuts, report]);

  // Camera callbacks (stable, so the webcam is not restarted on re-render).
  const handleCameraViolation = useCallback(
    (reason) => {
      setCameraLost(true);
      report('camera_lost', reason || 'Camera unavailable');
    },
    [report]
  );
  const handleCameraRecover = useCallback(() => setCameraLost(false), []);

  const handlePasteBlocked = useCallback(() => {
    report('paste', 'Tried to paste into an answer');
  }, [report]);

  const returnToFullscreen = () => {
    enterFullscreen().catch(() => notify('Your browser blocked full screen. Try again, or press F11.', 'warning'));
  };

  // ---- answers & navigation ---------------------------------------------
  const setAnswer = useCallback(
    (qid, value) => {
      if (!activeRef.current) return;
      const next = { ...answersRef.current, [qid]: value };
      answersRef.current = next;
      setAnswers(next);
      markDirty(qid);
    },
    [markDirty]
  );

  const goTo = useCallback(
    (i) => {
      const target = Math.max(0, Math.min(questions.length - 1, i));
      if (target !== indexRef.current) flush();
      indexRef.current = target;
      setIndex(target);
      setNavOpen(false);
      if (questionTopRef.current) {
        const top = questionTopRef.current.getBoundingClientRect().top + window.scrollY - 88;
        if (window.scrollY > top) window.scrollTo({ top, behavior: 'auto' });
      }
    },
    [questions.length, flush]
  );

  const toggleFlag = useCallback(() => {
    const qid = questions[index]?.id;
    if (!qid) return;
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(qid)) next.delete(qid);
      else next.add(qid);
      return next;
    });
  }, [questions, index]);

  // ---- submit -------------------------------------------------------------
  const doSubmit = useCallback(
    async ({ auto = false } = {}) => {
      if (submittingRef.current || !activeRef.current) return;
      submittingRef.current = true;
      setSubmitState({ submitting: true, error: null, auto });
      try {
        const res = await submitSubmission(submissionId, answersRef.current);
        stopAutosave({ clearBackup: true });
        finish({ fromExam: true, lateAnswersRejected: Boolean(res?.lateAnswersRejected), autoSubmitted: auto });
      } catch (err) {
        if (err?.status === 409) {
          stopAutosave({ clearBackup: true });
          finish({ fromExam: true, alreadySubmitted: true });
          return;
        }
        submittingRef.current = false;
        setSubmitState({ submitting: false, error: err?.message || 'Could not submit. Check your connection.', auto });
      }
    },
    [submissionId, stopAutosave, finish]
  );

  const handleExpire = useCallback(() => {
    setReviewOpen(false);
    notify("Time's up — submitting your answers.", 'warning');
    doSubmit({ auto: true });
  }, [doSubmit, notify]);

  const handleWarning = useCallback(
    (seconds) => {
      const msg = seconds <= 60 ? 'Less than 1 minute left.' : 'Less than 5 minutes left.';
      setTimeWarning(msg);
      notify(msg, seconds <= 60 ? 'error' : 'warning');
    },
    [notify]
  );

  const openReview = useCallback(() => {
    flush();
    setReviewOpen(true);
  }, [flush]);

  // ---- keyboard navigation: ←/→ between questions, 1–9 to pick an option -------
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (reviewOpen || navOpen || submittingRef.current || !activeRef.current) return;
      if (isTypingTarget(e.target)) return;
      if (rules.fullscreen && !getFullscreenElement()) return;
      // Native radio groups use the arrow keys to move between options.
      const targetType = e.target?.getAttribute?.('type');
      if (e.key === 'ArrowRight' && targetType !== 'radio') {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === 'ArrowLeft' && targetType !== 'radio') {
        e.preventDefault();
        goTo(index - 1);
      } else if (/^[1-9]$/.test(e.key)) {
        const q = questions[index];
        if (!q) return;
        const opts = q.options?.length ? q.options : q.type === 'true-false' ? ['True', 'False'] : [];
        const opt = opts[Number(e.key) - 1];
        if (opt === undefined) return;
        e.preventDefault();
        if (q.type === 'multiple-choice' || q.type === 'true-false') setAnswer(q.id, String(opt));
        else if (q.type === 'multiple-select') {
          const cur = Array.isArray(answersRef.current[q.id]) ? answersRef.current[q.id] : [];
          setAnswer(q.id, cur.includes(String(opt)) ? cur.filter((x) => x !== String(opt)) : [...cur, String(opt)]);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [index, questions, goTo, setAnswer, reviewOpen, navOpen, rules.fullscreen]);

  // ---- derived ------------------------------------------------------------
  const question = questions[index];
  const answeredCount = useMemo(() => questions.reduce((n, q) => n + (isAnswered(answers[q.id]) ? 1 : 0), 0), [questions, answers]);
  const unanswered = useMemo(
    () => questions.map((q, i) => (isAnswered(answers[q.id]) ? null : i)).filter((i) => i !== null),
    [questions, answers]
  );
  const flaggedIdx = useMemo(() => questions.map((q, i) => (flags.has(q.id) ? i : null)).filter((i) => i !== null), [questions, flags]);
  const needsFullscreen = rules.fullscreen && !isFullscreen;
  const isLast = index === questions.length - 1;
  const onChangeCurrent = useCallback((value) => setAnswer(question.id, value), [setAnswer, question]);

  const violationTone = violations >= maxViolations - 1 ? 'error' : violations > 0 ? 'warning' : null;

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', pb: { xs: 12, md: 6 } }}>
      {/* Top bar */}
      <Box
        component="header"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1100,
          bgcolor: alpha(theme.palette.background.paper, 0.92),
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 }, height: 64, display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 } }}>
          <BrandMark size={28} sx={{ display: { xs: 'none', sm: 'inline-flex' } }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h1" noWrap sx={{ fontWeight: 700, fontSize: { xs: '0.95rem', sm: '1.05rem' }, lineHeight: 1.3 }}>
              {assessment.title}
            </Typography>
            <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary', display: { xs: 'none', sm: 'block' } }}>
              {assessment.isPractice ? 'Practice quiz' : assessment.courseTitle || ''}
              {submission.attempt ? ` · Attempt ${submission.attempt}` : ''}
            </Typography>
          </Box>
          <SaveIndicator status={autosave.status} savedAt={autosave.savedAt} compact={isMobile} />
          {proctored && (
            <Tooltip title={`Integrity warnings: ${violations} of ${maxViolations}. At ${maxViolations} the attempt ends automatically.`}>
              <Box
                aria-label={`Integrity warnings ${violations} of ${maxViolations}`}
                role="status"
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.5,
                  px: 1,
                  height: 32,
                  borderRadius: 2,
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  fontVariantNumeric: 'tabular-nums',
                  color: violationTone ? `${violationTone}.main` : 'text.secondary',
                  bgcolor: violationTone ? alpha(theme.palette[violationTone].main, 0.12) : 'transparent',
                }}
              >
                <GppMaybeOutlinedIcon sx={{ fontSize: 18 }} aria-hidden="true" />
                {violations}/{maxViolations}
              </Box>
            </Tooltip>
          )}
          {endTime !== null && <ExamCountdown endTime={endTime} onExpire={handleExpire} onWarning={handleWarning} />}
          <Button
            variant="contained"
            onClick={openReview}
            disabled={submitState.submitting}
            sx={{ display: { xs: 'none', sm: 'inline-flex' }, flex: 'none' }}
          >
            Submit
          </Button>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 1200, mx: 'auto', px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 3 } }}>
        {/* Notices */}
        {submitState.error && (
          <Alert
            severity="error"
            sx={{ mb: 2 }}
            action={
              <Button color="inherit" size="small" onClick={() => doSubmit({ auto: submitState.auto })}>
                Retry
              </Button>
            }
          >
            {submitState.error} Your answers are safe on this device.
          </Alert>
        )}
        {submitState.submitting && !reviewOpen && (
          <Alert severity="info" icon={<CircularProgress size={18} />} sx={{ mb: 2 }}>
            Submitting your answers…
          </Alert>
        )}
        {cameraLost && rules.webcam && (
          <Alert severity="warning" icon={<VideocamOffRoundedIcon />} sx={{ mb: 2 }}>
            We can't see your camera. Check that it is connected and not used by another app. This was recorded.
          </Alert>
        )}
        {timeWarning && endTime !== null && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setTimeWarning(null)}>
            {timeWarning} Your answers are saved automatically and submitted when time runs out.
          </Alert>
        )}

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 280px' }, gap: 3, alignItems: 'start' }}>
          {/* Question panel */}
          <Paper
            ref={questionTopRef}
            variant="outlined"
            sx={{ position: 'relative', borderRadius: 4, p: { xs: 2.5, sm: 4, md: 5 }, minHeight: 360, overflow: 'hidden' }}
          >
            {needsFullscreen && (
              <Box
                role="alertdialog"
                aria-labelledby="fs-title"
                sx={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 2,
                  display: 'grid',
                  placeItems: 'center',
                  p: 3,
                  textAlign: 'center',
                  bgcolor: alpha(theme.palette.background.paper, 0.97),
                }}
              >
                <Box sx={{ maxWidth: 420 }}>
                  <FullscreenRoundedIcon sx={{ fontSize: 44, color: 'warning.main', mb: 1 }} aria-hidden="true" />
                  <Typography id="fs-title" variant="h6" component="h2" sx={{ mb: 1 }}>
                    Full screen is required
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2.5 }}>
                    {violations > 0
                      ? `Leaving full screen is recorded as an integrity warning (${violations} of ${maxViolations}). Return to full screen to keep working.`
                      : 'This assessment runs in full screen. Return to full screen to keep working.'}
                  </Typography>
                  <Button variant="contained" size="large" startIcon={<FullscreenRoundedIcon />} onClick={returnToFullscreen} autoFocus>
                    Return to full screen
                  </Button>
                </Box>
              </Box>
            )}
            {question && (
              <QuestionView
                key={question.id}
                question={question}
                index={index}
                total={questions.length}
                value={answers[question.id]}
                onChange={onChangeCurrent}
                onTextBlur={flush}
                flagged={flags.has(question.id)}
                onToggleFlag={toggleFlag}
                blockPaste={rules.shortcuts}
                onPasteBlocked={handlePasteBlocked}
                showKeyHints={!isMobile}
              />
            )}
            <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'space-between', alignItems: 'center', mt: 4, gap: 2 }}>
              <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => goTo(index - 1)} disabled={index === 0}>
                Previous
              </Button>
              <Typography variant="caption" sx={{ color: 'text.secondary', display: { xs: 'none', lg: 'block' } }}>
                Tip: use ← → to move between questions and 1–9 to choose an option.
              </Typography>
              {isLast ? (
                <Button variant="contained" onClick={openReview} disabled={submitState.submitting}>
                  Review &amp; submit
                </Button>
              ) : (
                <Button variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => goTo(index + 1)}>
                  Next
                </Button>
              )}
            </Box>
          </Paper>

          {/* Navigator (desktop) */}
          {!isMobile && (
            <Paper variant="outlined" sx={{ borderRadius: 4, p: 2.5, position: 'sticky', top: 88 }}>
              <Navigator questions={questions} answers={answers} flags={flags} current={index} onJump={goTo} />
              <Button fullWidth variant="outlined" sx={{ mt: 2.5 }} onClick={openReview} disabled={submitState.submitting}>
                Review &amp; submit
              </Button>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Bottom bar (mobile) */}
      {isMobile && (
        <Box
          sx={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 1100,
            bgcolor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            px: 2,
            py: 1.25,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            pb: 'calc(10px + env(safe-area-inset-bottom))',
          }}
        >
          <IconButton aria-label="Previous question" onClick={() => goTo(index - 1)} disabled={index === 0} sx={{ border: '1px solid', borderColor: 'divider' }}>
            <ArrowBackRoundedIcon />
          </IconButton>
          <Button
            onClick={() => setNavOpen(true)}
            startIcon={<GridViewRoundedIcon />}
            color="inherit"
            sx={{ flex: 1, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
            aria-label={`Question ${index + 1} of ${questions.length}. Open question list`}
          >
            {index + 1} / {questions.length}
          </Button>
          {isLast ? (
            <Button variant="contained" onClick={openReview} disabled={submitState.submitting}>
              Submit
            </Button>
          ) : (
            <IconButton aria-label="Next question" onClick={() => goTo(index + 1)} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } }}>
              <ArrowForwardRoundedIcon />
            </IconButton>
          )}
        </Box>
      )}
      <Drawer
        anchor="bottom"
        open={navOpen}
        onClose={() => setNavOpen(false)}
        PaperProps={{ sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, p: 2.5, pb: 'calc(20px + env(safe-area-inset-bottom))', maxHeight: '75vh' } }}
      >
        <Navigator questions={questions} answers={answers} flags={flags} current={index} onJump={goTo} />
        <Button fullWidth variant="contained" sx={{ mt: 2.5 }} onClick={() => { setNavOpen(false); openReview(); }}>
          Review &amp; submit
        </Button>
      </Drawer>

      {rules.webcam && <ProctoringWebcam onViolation={handleCameraViolation} onRecover={handleCameraRecover} />}

      {/* Review & submit */}
      <Dialog
        open={reviewOpen}
        onClose={() => !submitState.submitting && setReviewOpen(false)}
        fullWidth
        maxWidth="sm"
        aria-labelledby="review-title"
      >
        <DialogTitle id="review-title">Submit your answers?</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: { xs: 1, sm: 1.5 }, mb: 2.5 }}>
            {[
              { label: 'Answered', value: answeredCount, tone: 'success' },
              { label: 'Unanswered', value: unanswered.length, tone: unanswered.length ? 'warning' : null },
              { label: 'Flagged', value: flaggedIdx.length, tone: flaggedIdx.length ? 'secondary' : null },
            ].map((s) => (
              <Box key={s.label} sx={{ p: { xs: 1, sm: 1.5 }, borderRadius: 3, border: '1px solid', borderColor: 'divider', textAlign: 'center', minWidth: 0 }}>
                <Typography sx={{ fontSize: '1.6rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.tone ? `${s.tone}.main` : 'text.primary' }}>
                  {s.value}
                </Typography>
                <Typography variant="caption" noWrap component="p" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>
          {[
            { title: 'Unanswered', items: unanswered },
            { title: 'Flagged for review', items: flaggedIdx },
          ]
            .filter((g) => g.items.length)
            .map((g) => (
              <Box key={g.title} sx={{ mb: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  {g.title}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                  {g.items.map((i) => (
                    <Button
                      key={i}
                      size="small"
                      variant="outlined"
                      onClick={() => {
                        setReviewOpen(false);
                        goTo(i);
                      }}
                      disabled={submitState.submitting}
                      sx={{ minWidth: 40, px: 1 }}
                      aria-label={`Go to question ${i + 1}`}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </Box>
              </Box>
            ))}
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            {unanswered.length
              ? `You have ${pluralize(unanswered.length, 'unanswered question')}. Unanswered questions score zero.`
              : 'All questions are answered.'}{' '}
            You can't change your answers after submitting.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setReviewOpen(false)} disabled={submitState.submitting}>
            Keep working
          </Button>
          <Button
            variant="contained"
            onClick={() => doSubmit()}
            disabled={submitState.submitting}
            startIcon={submitState.submitting ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {submitState.submitting ? 'Submitting…' : 'Submit now'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
