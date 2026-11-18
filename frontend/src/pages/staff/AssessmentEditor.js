import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlinedIcon from '@mui/icons-material/CloudOffOutlined';
import PublishRoundedIcon from '@mui/icons-material/PublishRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Skeleton,
  Step,
  StepButton,
  Stepper,
  TextField,
  Typography,
} from '@mui/material';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { createAssessment, getAssessment, publishAssessment, updateAssessment } from '../../api/assessments';
import { getCourse, listCourses } from '../../api/courses';
import { createQuestions, importToAssessment } from '../../api/questionBank';
import { EmptyState } from '../../components/common';
import ConfirmDialog from '../../components/staff/ConfirmDialog';
import AiQuestionGenerator from '../../components/staff/editor/AiQuestionGenerator';
import QuestionBankPicker from '../../components/staff/editor/QuestionBankPicker';
import QuestionsStep from '../../components/staff/editor/QuestionsStep';
import ReviewStep, { buildChecklist } from '../../components/staff/editor/ReviewStep';
import SettingsStep from '../../components/staff/editor/SettingsStep';
import { AssessmentStatusChip, ErrorState, SectionCard, useIsMobile } from '../../components/staff/StaffUI';
import { formatRelative, normalizeQuestion, pluralize, toApiQuestion } from '../../components/staff/staffUtils';
import useNavigationGuard from '../../components/staff/useNavigationGuard';
import usePlanError from '../../components/staff/usePlanError';
import { useBreadcrumb } from '../../components/layout/breadcrumb';
import { useNotify } from '../../contexts/NotificationContext';

const STEPS = ['Details', 'Questions', 'Settings', 'Review & publish'];
const AUTOSAVE_MS = 1200;

const DEFAULTS = {
  courseId: '',
  title: '',
  description: '',
  instructions: '',
  availableFrom: null,
  dueDate: null,
  timeLimit: 0,
  maxAttempts: 1,
  passingScore: 50,
  shuffleQuestions: false,
  shuffleOptions: false,
  resultsPolicy: 'immediate',
  showCorrectAnswers: false,
  proctoring: { enabled: false, fullscreen: false, webcam: false, blockShortcuts: false, maxViolations: 5 },
  questions: [],
};

const fromApi = (a) => ({
  courseId: a.courseId || a.course || '',
  title: a.title || '',
  description: a.description || '',
  instructions: a.instructions || '',
  availableFrom: a.availableFrom || null,
  dueDate: a.dueDate || null,
  timeLimit: a.timeLimit ?? 0,
  maxAttempts: a.maxAttempts ?? 1,
  passingScore: a.passingScore ?? 50,
  shuffleQuestions: !!a.shuffleQuestions,
  shuffleOptions: !!a.shuffleOptions,
  resultsPolicy: a.resultsPolicy || 'immediate',
  showCorrectAnswers: !!a.showCorrectAnswers,
  proctoring: { ...DEFAULTS.proctoring, ...(a.proctoring || {}) },
  questions: (a.questions || []).map((q) => normalizeQuestion(q)),
});

/** Request body for the API. Questions without text are kept locally but not sent. */
const toBody = (f) => ({
  title: f.title.trim(),
  description: f.description,
  instructions: f.instructions,
  availableFrom: f.availableFrom,
  dueDate: f.dueDate,
  timeLimit: Number(f.timeLimit) || 0,
  maxAttempts: Number(f.maxAttempts) || 1,
  passingScore: Number(f.passingScore) || 0,
  shuffleQuestions: f.shuffleQuestions,
  shuffleOptions: f.shuffleOptions,
  resultsPolicy: f.resultsPolicy,
  showCorrectAnswers: f.showCorrectAnswers,
  proctoring: f.proctoring,
  questions: f.questions.filter((q) => String(q.text || '').trim()).map(toApiQuestion),
});

const diffBody = (body, saved) => {
  const patch = {};
  Object.keys(body).forEach((k) => {
    if (JSON.stringify(body[k]) !== JSON.stringify(saved?.[k])) patch[k] = body[k];
  });
  return patch;
};

const dateError = (f) =>
  f.availableFrom && f.dueDate && new Date(f.availableFrom) >= new Date(f.dueDate) ? 'The due date must be after the opening date' : null;

function SaveIndicator({ state, savedAt, onRetry, status }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  let content;
  if (state === 'saving')
    content = (
      <>
        <CircularProgress size={14} /> Saving…
      </>
    );
  else if (state === 'pending') content = <>Unsaved changes</>;
  else if (state === 'error')
    content = (
      <>
        <CloudOffOutlinedIcon fontSize="small" color="error" /> Not saved
        <Button size="small" onClick={onRetry} sx={{ minWidth: 0, ml: 0.5 }}>
          Retry
        </Button>
      </>
    );
  else if (state === 'invalid') content = <>Fix the highlighted fields to save</>;
  else if (savedAt)
    content = (
      <>
        <CloudDoneOutlinedIcon fontSize="small" color="success" /> Saved {formatRelative(savedAt)}
      </>
    );
  else content = status === 'draft' ? <>Drafts save automatically</> : null;
  return (
    <Typography
      variant="caption"
      role="status"
      aria-live="polite"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        color: state === 'error' ? 'error.main' : 'text.secondary',
        fontWeight: 600,
      }}
    >
      {content}
    </Typography>
  );
}

export default function AssessmentEditor() {
  const { assessmentId: routeId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const handleError = usePlanError();
  const isMobile = useIsMobile();

  const [id, setId] = useState(routeId || null);
  const [meta, setMeta] = useState({ status: 'draft', submissionCount: 0 });
  const [form, setForm] = useState(() => ({ ...DEFAULTS, courseId: params.get('courseId') || '' }));
  const [load, setLoad] = useState({ loading: !!routeId, error: null });
  const [courses, setCourses] = useState({ items: [], loading: true, error: null });
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const [touched, setTouched] = useState(false);
  const [source, setSource] = useState(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [bankOpen, setBankOpen] = useState(false);
  const [bankBusy, setBankBusy] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [confirmPublish, setConfirmPublish] = useState(false);
  // Fresh active-enrolment count from the server when the publish dialog opens.
  const [publishCount, setPublishCount] = useState(null);
  const [serverProblems, setServerProblems] = useState(null);

  const savedRef = useRef(null);
  const formRef = useRef(form);
  formRef.current = form;
  const idRef = useRef(id);
  idRef.current = id;
  const savingRef = useRef(null);

  const step = Math.max(0, Math.min(STEPS.length - 1, Number(params.get('step') || 0)));
  const locked = meta.submissionCount > 0;
  const isDraft = meta.status === 'draft';

  // ---- Loading ----------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    listCourses({ pageSize: 100 })
      .then((res) => !cancelled && setCourses({ items: res.items || [], loading: false, error: null }))
      .catch((error) => !cancelled && setCourses({ items: [], loading: false, error }));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadAssessment = useCallback(async (aid) => {
    setLoad({ loading: true, error: null });
    try {
      const a = await getAssessment(aid);
      const f = fromApi(a);
      setForm(f);
      savedRef.current = toBody(f);
      setMeta({ status: a.status, submissionCount: a.submissionCount || 0, courseTitle: a.courseTitle });
      setId(a.id);
      setLoad({ loading: false, error: null });
    } catch (error) {
      setLoad({ loading: false, error });
    }
  }, []);

  useEffect(() => {
    // Skip the reload when we just created this assessment ourselves.
    if (routeId && routeId !== idRef.current) loadAssessment(routeId);
    else if (routeId && !savedRef.current) loadAssessment(routeId);
  }, [routeId, loadAssessment]);

  const set = useCallback((patch) => setForm((f) => ({ ...f, ...patch })), []);
  const setQuestions = useCallback(
    (updater) => setForm((f) => ({ ...f, questions: typeof updater === 'function' ? updater(f.questions) : updater })),
    [],
  );

  const course = useMemo(() => courses.items.find((c) => c.id === form.courseId) || null, [courses.items, form.courseId]);
  const topics = useMemo(() => {
    const set2 = new Set([...(course?.topics || []), ...form.questions.map((q) => q.topic).filter(Boolean)]);
    return [...set2];
  }, [course, form.questions]);
  useBreadcrumb(
    form.title.trim() || (id ? 'Edit assessment' : 'New assessment'),
    course
      ? { label: course.title, to: `/app/courses/${course.id}/assessments` }
      : meta.courseTitle && form.courseId
        ? { label: meta.courseTitle, to: `/app/courses/${form.courseId}/assessments` }
        : { label: 'Courses', to: '/app/courses' },
  );

  // ---- Saving -----------------------------------------------------------
  const pendingPatch = useCallback(() => {
    const body = toBody(formRef.current);
    if (!idRef.current) return body;
    return diffBody(body, savedRef.current);
  }, []);

  // Set once the navigation guard exists (below); lets our own redirects skip the prompt.
  const bypassRef = useRef((fn) => fn());
  const isDraftRef = useRef(isDraft);
  isDraftRef.current = isDraft;

  /** Persists pending changes. Creates the draft first when needed. Resolves the assessment id (or null). */
  const saveNow = useCallback(
    async ({ quiet = false } = {}) => {
      if (savingRef.current) {
        await savingRef.current.catch(() => {});
      }
      const f = formRef.current;
      if (dateError(f)) {
        setSaveState('invalid');
        return null;
      }
      const run = (async () => {
        if (!idRef.current) {
          if (!f.courseId || !f.title.trim()) return null;
          setSaveState('saving');
          const body = toBody(f);
          const created = await createAssessment({ ...body, courseId: f.courseId, source: source || 'manual' });
          savedRef.current = body;
          idRef.current = created.id;
          setId(created.id);
          setMeta({ status: created.status, submissionCount: 0, courseTitle: created.courseTitle });
          setSavedAt(new Date());
          setSaveState('saved');
          bypassRef.current(() => navigate(`/app/assessments/${created.id}/edit${window.location.search}`, { replace: true }));
          return created.id;
        }
        const patch = pendingPatch();
        if (!Object.keys(patch).length) {
          setSaveState('saved');
          return idRef.current;
        }
        setSaveState('saving');
        if (source && !savedRef.current?.source) patch.source = source;
        const force = patch.questions && meta.submissionCount > 0;
        await updateAssessment(idRef.current, patch, { force });
        savedRef.current = { ...savedRef.current, ...patch };
        setSavedAt(new Date());
        setSaveState(Object.keys(pendingPatch()).length ? 'pending' : 'saved');
        return idRef.current;
      })();
      savingRef.current = run;
      try {
        return await run;
      } catch (err) {
        setSaveState('error');
        if (err?.status === 409 && err?.details?.reason === 'has-submissions') {
          setMeta((m) => ({ ...m, submissionCount: Math.max(1, m.submissionCount) }));
          notify('A student has started this assessment, so its questions are now locked. Only wording can change.', 'warning');
        } else if (Array.isArray(err?.details?.problems)) {
          setServerProblems(err.details.problems);
        } else if (!quiet) handleError(err, 'Could not save');
        return null;
      } finally {
        savingRef.current = null;
      }
    },
    [handleError, meta.submissionCount, navigate, notify, pendingPatch, source],
  );

  const dirty = useMemo(() => {
    if (!id) return !!(form.title.trim() || form.questions.length || form.description);
    return Object.keys(diffBody(toBody(form), savedRef.current)).length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, id, savedAt]);

  // Autosave drafts (debounced).
  useEffect(() => {
    if (load.loading || load.error || !isDraft) return undefined;
    if (!dirty) return undefined;
    if (!id && (!form.courseId || !form.title.trim())) return undefined;
    if (dateError(form)) {
      setSaveState('invalid');
      return undefined;
    }
    setSaveState((s) => (s === 'saving' ? s : 'pending'));
    const t = setTimeout(() => saveNow({ quiet: true }), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [form, dirty, isDraft, id, load.loading, load.error, saveNow]);

  // Flush a draft's pending changes when leaving the page.
  useEffect(
    () => () => {
      if (
        isDraftRef.current &&
        idRef.current &&
        Object.keys(diffBody(toBody(formRef.current), savedRef.current || {})).length &&
        savedRef.current
      ) {
        updateAssessment(idRef.current, diffBody(toBody(formRef.current), savedRef.current)).catch(() => {});
      }
    },
    [],
  );

  // Ask before leaving with unsaved work that autosave can't cover.
  const needsGuard =
    dirty && (!isDraft || saveState === 'error' || saveState === 'invalid' || (!id && (!form.courseId || !form.title.trim())));
  const navGuard = useNavigationGuard(needsGuard);
  bypassRef.current = navGuard.bypass;

  const goStep = (s, questionId) => {
    navGuard.bypass(() => {
      const next = new URLSearchParams(params);
      if (s) next.set('step', String(s));
      else next.delete('step');
      setParams(next, { replace: true });
    });
    if (questionId) setFocusId(questionId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ---- Question helpers -------------------------------------------------
  const acceptAi = (qs) => {
    if (!form.questions.length) setSource('ai-syllabus');
    setQuestions((list) => [...list, ...qs]);
    setAiOpen(false);
    notify(`Added ${pluralize(qs.length, 'question')} — review them before publishing`, 'success');
  };

  const saveToBank = async (qs) => {
    const valid = qs.filter((q) => String(q.text || '').trim());
    if (!valid.length) return;
    try {
      await createQuestions(valid.map(toApiQuestion), form.courseId || undefined);
      notify(`Saved ${pluralize(valid.length, 'question')} to the question bank`, 'success');
    } catch (err) {
      handleError(err, 'Could not save to the question bank');
    }
  };

  const importFromBank = async (items) => {
    setBankBusy(true);
    try {
      const aid = (await saveNow()) || idRef.current;
      if (!aid) {
        notify('Add a title and choose a course first', 'warning');
        setBankOpen(false);
        goStep(0);
        return;
      }
      await importToAssessment(
        aid,
        items.map((i) => i.id),
      );
      const fresh = await getAssessment(aid);
      const qs = (fresh.questions || []).map((q) => normalizeQuestion(q));
      setForm((f) => ({ ...f, questions: qs }));
      savedRef.current = { ...(savedRef.current || {}), questions: qs.map(toApiQuestion) };
      setSavedAt(new Date());
      setBankOpen(false);
      notify(`Imported ${pluralize(items.length, 'question')}`, 'success');
    } catch (err) {
      handleError(err, 'Could not import questions');
    } finally {
      setBankBusy(false);
    }
  };

  // ---- Publish ----------------------------------------------------------
  const checklist = useMemo(() => buildChecklist(form), [form]);

  const publish = async () => {
    setPublishing(true);
    try {
      const aid = await saveNow();
      if (!aid) return;
      await publishAssessment(aid);
      notify('Published — students have been notified', 'success');
      setConfirmPublish(false);
      navGuard.bypass(() => navigate(`/app/assessments/${aid}`));
    } catch (err) {
      if (Array.isArray(err?.details?.problems)) setServerProblems(err.details.problems);
      else handleError(err, 'Could not publish');
    } finally {
      setPublishing(false);
    }
  };

  const saveChanges = async () => {
    setTouched(true);
    const aid = await saveNow();
    if (aid) notify('Changes saved', 'success');
  };

  // ---- Render -----------------------------------------------------------
  if (load.error) {
    if (load.error.status === 404) {
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
    return <ErrorState error={load.error} onRetry={() => loadAssessment(routeId)} title="We couldn’t open this assessment" backTo="/app/courses" backLabel="Back to courses" />;
  }

  const titleError = touched && !form.title.trim();
  const courseError = touched && !form.courseId;

  return (
    <Box sx={{ pb: 4 }}>
      <Box
        component="header"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-end', justifyContent: 'space-between', mb: 3 }}
      >
        <Box sx={{ minWidth: 0, flex: '1 1 320px' }}>
          <Typography variant="overline" component="p" sx={{ color: 'text.secondary' }}>
            {id ? 'Edit assessment' : 'New assessment'}
          </Typography>
          {load.loading ? (
            <Skeleton width="60%" height={44} />
          ) : (
            <Typography variant="h3" component="h1" sx={{ wordBreak: 'break-word' }}>
              {form.title.trim() || 'Untitled assessment'}
            </Typography>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1, flexWrap: 'wrap' }}>
            <AssessmentStatusChip status={meta.status} />
            <SaveIndicator state={saveState} savedAt={savedAt} onRetry={() => saveNow()} status={meta.status} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {isDraft ? (
            <Button variant="contained" startIcon={<PublishRoundedIcon />} onClick={() => goStep(3)} disabled={load.loading}>
              Review & publish
            </Button>
          ) : (
            <Button
              variant="contained"
              startIcon={saveState === 'saving' ? <CircularProgress size={16} color="inherit" /> : <CheckRoundedIcon />}
              onClick={saveChanges}
              disabled={!dirty || saveState === 'saving' || load.loading}
            >
              Save changes
            </Button>
          )}
        </Box>
      </Box>

      {!isDraft && !load.loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This assessment is {meta.status}. Changes are saved when you click “Save changes”
          {locked ? ' — questions are locked because students have started' : ''}.
        </Alert>
      )}

      {isMobile && (
        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} aria-live="polite">
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </Typography>
            <TextField
              select
              size="small"
              value={step}
              onChange={(e) => goStep(Number(e.target.value))}
              inputProps={{ 'aria-label': 'Go to step' }}
              sx={{ minWidth: 120 }}
            >
              {STEPS.map((label, i) => (
                <MenuItem key={label} value={i}>
                  {i + 1}. {label}
                </MenuItem>
              ))}
            </TextField>
          </Box>
          <LinearProgress variant="determinate" value={((step + 1) / STEPS.length) * 100} sx={{ height: 6, borderRadius: 3 }} aria-hidden="true" />
        </Box>
      )}
      <Box sx={{ mb: 3, pb: 0.5, display: isMobile ? 'none' : 'block' }}>
        <Stepper nonLinear activeStep={step}>
          {STEPS.map((label, i) => {
            const hasError =
              (i === 0 && ((touched && !form.title.trim()) || (touched && !form.courseId))) ||
              (i === 1 && checklist.blocking.some((b) => b.step === 1) && form.questions.length > 0) ||
              (i === 2 && !!dateError(form));
            return (
              <Step key={label} completed={false}>
                <StepButton
                  onClick={() => goStep(i)}
                  optional={
                    hasError ? (
                      <Typography variant="caption" color="error">
                        Needs attention
                      </Typography>
                    ) : null
                  }
                >
                  {label}
                </StepButton>
              </Step>
            );
          })}
        </Stepper>
      </Box>

      {load.loading ? (
        <Box sx={{ display: 'grid', gap: 2 }}>
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={64} />
          <Skeleton variant="rounded" height={160} />
        </Box>
      ) : (
        <>
          {step === 0 && (
            <SectionCard title="Details" subtitle="What students see before they start.">
              <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, alignItems: 'start' }}>
                <FormControl error={courseError} disabled={!!id || courses.loading}>
                  <InputLabel id="ae-course">Course</InputLabel>
                  <Select
                    labelId="ae-course"
                    label="Course"
                    value={courses.loading ? '' : form.courseId}
                    onChange={(e) => set({ courseId: e.target.value })}
                  >
                    {courses.items.map((c) => (
                      <MenuItem key={c.id} value={c.id}>
                        {c.code ? `${c.code} — ` : ''}
                        {c.title}
                      </MenuItem>
                    ))}
                    {!courses.loading && form.courseId && !courses.items.some((c) => c.id === form.courseId) && (
                      <MenuItem value={form.courseId}>{meta.courseTitle || 'Current course'}</MenuItem>
                    )}
                  </Select>
                  <FormHelperText>
                    {courseError
                      ? 'Choose a course'
                      : id
                        ? 'An assessment stays in the course it was created in. Duplicate it to reuse elsewhere.'
                        : courses.error
                          ? 'Could not load your courses'
                          : !courses.loading && !courses.items.length
                            ? 'Create a course first.'
                            : 'Enrolled students of this course can take it once published.'}
                  </FormHelperText>
                </FormControl>
                <TextField
                  label="Title"
                  required
                  value={form.title}
                  onChange={(e) => set({ title: e.target.value })}
                  onBlur={() => setTouched(true)}
                  error={titleError}
                  helperText={
                    titleError
                      ? 'Give the assessment a title'
                      : !id
                        ? 'Your draft is saved automatically once it has a title and a course.'
                        : ' '
                  }
                  inputProps={{ maxLength: 200 }}
                  autoFocus={!id}
                />
                <TextField
                  label="Description"
                  multiline
                  minRows={4}
                  value={form.description}
                  onChange={(e) => set({ description: e.target.value })}
                  helperText="Shown on the course page, e.g. what it covers."
                  inputProps={{ maxLength: 5000 }}
                />
                <TextField
                  label="Instructions"
                  multiline
                  minRows={4}
                  value={form.instructions}
                  onChange={(e) => set({ instructions: e.target.value })}
                  helperText="Shown just before students start, e.g. allowed materials or proctoring rules."
                  inputProps={{ maxLength: 5000 }}
                />
              </Box>
            </SectionCard>
          )}
          {step === 1 && (
            <QuestionsStep
              questions={form.questions}
              setQuestions={setQuestions}
              topics={topics}
              locked={locked}
              focusId={focusId}
              onGenerateAi={() => setAiOpen(true)}
              onImportBank={() => setBankOpen(true)}
              onSaveToBank={saveToBank}
            />
          )}
          {step === 2 && <SettingsStep form={form} set={set} errors={{ dueDate: dateError(form) }} />}
          {step === 3 && <ReviewStep form={form} courseTitle={course?.title || meta.courseTitle} checklist={checklist} onJump={goStep} />}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mt: 3, flexWrap: 'wrap' }}>
            <Button color="inherit" onClick={() => goStep(step - 1)} disabled={step === 0}>
              Back
            </Button>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {step < 3 ? (
                <Button variant="outlined" onClick={() => goStep(step + 1)}>
                  Next: {STEPS[step + 1]}
                </Button>
              ) : isDraft ? (
                <>
                  <Button
                    variant="outlined"
                    onClick={async () => {
                      setTouched(true);
                      const aid = await saveNow();
                      if (aid) {
                        notify('Draft saved', 'success');
                        navGuard.bypass(() => navigate(`/app/courses/${form.courseId}/assessments`));
                      }
                    }}
                    disabled={!form.title.trim() || !form.courseId}
                  >
                    Save draft & exit
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<PublishRoundedIcon />}
                    onClick={() => {
                      setTouched(true);
                      setConfirmPublish(true);
                      setPublishCount(null);
                      getCourse(form.courseId)
                        .then((c) => setPublishCount(c.studentCount ?? null))
                        .catch(() => setPublishCount(null));
                    }}
                    disabled={checklist.blocking.length > 0}
                  >
                    Publish
                  </Button>
                </>
              ) : (
                <Button variant="contained" onClick={saveChanges} disabled={!dirty || saveState === 'saving'}>
                  Save changes
                </Button>
              )}
            </Box>
          </Box>
        </>
      )}

      <AiQuestionGenerator open={aiOpen} onClose={() => setAiOpen(false)} onAccept={acceptAi} courseId={form.courseId} course={course} />
      <QuestionBankPicker
        open={bankOpen}
        onClose={() => setBankOpen(false)}
        onAdd={importFromBank}
        courseId={form.courseId || undefined}
        busy={bankBusy}
        excludeTexts={form.questions.map((q) => q.text)}
      />
      <ConfirmDialog
        open={confirmPublish}
        title="Publish this assessment?"
        description={`${pluralize(form.questions.length, 'question')} will be published to ${publishCount === null ? 'the enrolled students' : pluralize(publishCount, 'enrolled student')}, who will be notified. Questions lock as soon as someone starts.`}
        confirmLabel={publishing ? 'Publishing…' : 'Publish'}
        onConfirm={publish}
        onClose={() => setConfirmPublish(false)}
      />
      <ConfirmDialog
        open={!!serverProblems}
        title="Not ready yet"
        confirmLabel="Go to questions"
        onConfirm={() => {
          setServerProblems(null);
          goStep(1);
        }}
        onClose={() => setServerProblems(null)}
      >
        <Box component="ul" sx={{ pl: 2.5, my: 0 }}>
          {(serverProblems || []).map((p) => (
            <Typography component="li" variant="body2" key={p}>
              {p}
            </Typography>
          ))}
        </Box>
      </ConfirmDialog>
      <ConfirmDialog
        open={navGuard.blocked}
        title="Leave without saving?"
        description={
          !id
            ? 'This assessment hasn’t been saved yet — add a title and choose a course so it can be saved as a draft.'
            : 'You have changes that haven’t been saved.'
        }
        confirmLabel="Leave"
        cancelLabel="Stay"
        tone="error"
        onConfirm={navGuard.proceed}
        onClose={navGuard.cancel}
      />
    </Box>
  );
}
