import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Select,
  Step,
  StepLabel,
  Stepper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import React, { useEffect, useRef, useState } from 'react';
import { UpgradePrompt } from '../../common';
import { analyzeSyllabus, generateQuestions, getAssessmentTemplates, uploadSyllabus } from '../../../api/ai';
import { ToneChip } from '../StaffUI';
import { DIFFICULTIES, QUESTION_TYPES, answerKeyText, normalizeQuestion, questionTypeLabel } from '../staffUtils';
import { isPlanLimit } from '../usePlanError';

const STEPS = ['Syllabus', 'Pattern', 'Review'];
const MIN_CHARS = 50;
const ACCEPT = '.pdf,.doc,.docx,.txt';

const ANALYZE_STAGES = ['Reading your syllabus…', 'Finding the key topics…', 'Suggesting assessment patterns…', 'Almost there…'];
const GENERATE_STAGES = ['Planning the questions…', 'Writing questions…', 'Checking answer keys…', 'Almost there…'];

const typeForAi = (t) =>
  ({ 'multiple-choice': 'Multiple Choice', 'multiple-select': 'Multiple Choice', 'true-false': 'True/False', 'short-answer': 'Short Answer', essay: 'Essay' })[t] ||
  'Multiple Choice';

/** Pattern rows, whichever shape they come in: [{ type, count, pointsEach }]. */
/**
 * Topic names from the analyser. Its fallback sometimes returns a whole numbered
 * list as one "topic", so long entries are split on list markers and separators.
 */
const cleanTopics = (list) =>
  [
    ...new Set(
      (Array.isArray(list) ? list : [])
        .flatMap((t) => {
          const s = String(t || '').trim();
          return s.length <= 60 ? [s] : s.split(/\s*(?:\d+[.)]\s+|[;•\n]|,\s+|\.\s+)\s*/);
        })
        .map((t) => t.replace(/^[-–•\d.)\s]+/, '').replace(/[.:;,]+$/, '').trim())
        .filter((t) => t.length >= 3 && t.length <= 60 && !/^learning outcomes?/i.test(t))
    ),
  ].slice(0, 30);

const patternRows = (p) =>
  (p?.questionDistribution || p?.structure || []).map((r) => ({
    type: normalizeQuestion({ type: r.type || r.questionType }).type,
    count: Number(r.count) || 0,
    pointsEach: Number(r.pointsEach ?? r.pointsPerQuestion) || 1,
  }));

function Busy({ stages, startedAt, onCancel, label }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const secs = Math.max(0, Math.round((now - startedAt) / 1000));
  const stage = stages[Math.min(stages.length - 1, Math.floor(secs / 7))];
  return (
    <Box role="status" aria-live="polite" sx={{ py: 5, textAlign: 'center', maxWidth: 420, mx: 'auto' }}>
      <Box
        aria-hidden="true"
        sx={(t) => ({
          width: 56,
          height: 56,
          borderRadius: '50%',
          mx: 'auto',
          mb: 2,
          display: 'grid',
          placeItems: 'center',
          color: 'primary.main',
          bgcolor: alpha(t.palette.primary.main, 0.1),
          '@keyframes pulse': { '0%,100%': { transform: 'scale(1)' }, '50%': { transform: 'scale(1.08)' } },
          animation: 'pulse 1.6s ease-in-out infinite',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        })}
      >
        <AutoAwesomeRoundedIcon />
      </Box>
      <Typography variant="h6" component="p">
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
        {stage} {secs}s
      </Typography>
      <LinearProgress sx={{ mt: 2.5, borderRadius: 2 }} />
      <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1.5 }}>
        AI can take up to a minute. You can keep this window open or cancel.
      </Typography>
      <Button onClick={onCancel} sx={{ mt: 2 }} color="inherit" variant="outlined">
        Cancel
      </Button>
    </Box>
  );
}

function PatternCard({ selected, onSelect, title, description, rows, badge, meta }) {
  return (
    <ButtonBase
      onClick={onSelect}
      aria-pressed={selected}
      sx={(t) => ({
        display: 'block',
        textAlign: 'left',
        width: '100%',
        p: 2,
        borderRadius: 3,
        border: '1.5px solid',
        borderColor: selected ? 'primary.main' : 'divider',
        bgcolor: selected ? alpha(t.palette.primary.main, 0.05) : 'background.paper',
        '&.Mui-focusVisible': { outline: `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
      })}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          {title}
        </Typography>
        {badge}
        {selected && <CheckCircleRoundedIcon color="primary" fontSize="small" />}
      </Box>
      {description && (
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
          {description}
        </Typography>
      )}
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        {rows.map((r, i) => (
          <Chip key={i} size="small" variant="outlined" label={`${r.count} × ${questionTypeLabel(r.type)}`} />
        ))}
      </Box>
      {meta && (
        <Typography variant="caption" component="p" sx={{ color: 'text.secondary', mt: 1 }}>
          {meta}
        </Typography>
      )}
    </ButtonBase>
  );
}

/**
 * "Generate with AI from a syllabus": upload or paste → analyse → choose a pattern
 * → generate → review and accept selected questions. `onAccept(questions)`.
 */
export default function AiQuestionGenerator({ open, onClose, onAccept, courseId, course }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));
  const fileInput = useRef(null);
  const run = useRef(0);
  const [step, setStep] = useState(0);
  const [sourceTab, setSourceTab] = useState('upload');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [uploadPct, setUploadPct] = useState(null);
  const [busy, setBusy] = useState(null); // { kind, startedAt }
  const [error, setError] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [topics, setTopics] = useState([]);
  const [focus, setFocus] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [patternKey, setPatternKey] = useState('custom');
  const [custom, setCustom] = useState([
    { type: 'multiple-choice', count: 6, pointsEach: 1 },
    { type: 'true-false', count: 2, pointsEach: 1 },
    { type: 'short-answer', count: 2, pointsEach: 2 },
  ]);
  const [difficulty, setDifficulty] = useState('Medium');
  const [generated, setGenerated] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [generatedBy, setGeneratedBy] = useState('');
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    run.current += 1;
    setStep(0);
    setError(null);
    setBusy(null);
    setGenerated([]);
    setSelected(new Set());
    setUploadPct(null);
    getAssessmentTemplates(courseId || 'default')
      .then((res) => setTemplates(res?.templates || []))
      .catch(() => setTemplates([]));
  }, [open, courseId]);

  const aiPatterns = analysis?.assessmentPatterns?.patterns || [];
  const patternOptions = [
    ...aiPatterns.map((p, i) => ({ key: `ai-${i}`, title: p.name || `Suggested pattern ${i + 1}`, description: p.description, rows: patternRows(p), raw: p, ai: true })),
    ...templates.map((t, i) => ({ key: `tpl-${i}`, title: t.name, description: t.description, rows: patternRows(t), raw: t, recommended: t.isRecommended })),
  ];

  const fail = (err, fallbackMsg) => {
    if (err?.code === 'CANCELED') return;
    setError({ planLimit: isPlanLimit(err), raw: err, rateLimited: err?.status === 429, message: err?.message || fallbackMsg });
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'doc', 'docx', 'txt'].includes(ext)) {
      setError({ message: 'Choose a PDF, Word (.docx) or plain-text file.' });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError({ message: 'That file is larger than 10 MB. Try a smaller file or paste the text instead.' });
      return;
    }
    const id = ++run.current;
    setFileName(file.name);
    setUploadPct(0);
    try {
      const res = await uploadSyllabus(file, {
        onUploadProgress: (e) => e.total && setUploadPct(Math.round((e.loaded / e.total) * 100)),
      });
      if (id !== run.current) return;
      setText(res.syllabusContent || '');
      setSourceTab('paste');
      if (!res.syllabusContent || res.syllabusContent.trim().length < MIN_CHARS) {
        setError({ message: 'We could not read much text from that file. Paste the syllabus text instead.' });
      }
    } catch (err) {
      if (id === run.current) fail(err, 'Could not read that file.');
    } finally {
      if (id === run.current) setUploadPct(null);
    }
  };

  const analyze = async () => {
    setError(null);
    const id = ++run.current;
    setBusy({ kind: 'analyze', startedAt: Date.now() });
    try {
      const res = await analyzeSyllabus({ syllabusContent: text, courseId });
      if (id !== run.current) return;
      let found = cleanTopics(res.syllabusTopics?.length ? res.syllabusTopics : res.syllabusAnalysis?.learningOutcomes?.keyTopics);
      if (!found.length) found = cleanTopics(res.syllabusAnalysis?.learningOutcomes?.keyTopics);
      if (!found.length) found = cleanTopics(course?.topics);
      setAnalysis(res.syllabusAnalysis || {});
      setTopics(found);
      setFocus(found.slice(0, 8));
      setPatternKey(res.syllabusAnalysis?.assessmentPatterns?.patterns?.length ? 'ai-0' : 'custom');
      setStep(1);
    } catch (err) {
      if (id === run.current) fail(err, 'The AI could not analyse this syllabus.');
    } finally {
      if (id === run.current) setBusy(null);
    }
  };

  /** Fallback when analysis is unavailable: use the course's own topics. */
  const fallbackToCourseTopics = () => {
    const t = course?.topics || [];
    setAnalysis({
      basicInfo: { courseTitle: course?.title || '', courseCode: course?.code || '' },
      learningOutcomes: { keyTopics: t, objectives: [], skillsGained: [] },
      rawSyllabus: text.slice(0, 4000),
    });
    setTopics(t);
    setFocus(t.slice(0, 8));
    setPatternKey('custom');
    setError(null);
    setStep(1);
  };

  const generate = async () => {
    setError(null);
    const opt = patternOptions.find((p) => p.key === patternKey);
    const rows = (opt ? opt.rows : custom).filter((r) => r.count > 0);
    const pattern = {
      ...(opt?.raw || {}),
      name: opt?.title || 'Custom pattern',
      difficulty,
      topicFocus: focus,
      questionDistribution: rows.map((r) => ({ type: r.type, count: r.count, pointsEach: r.pointsEach })),
      structure: rows.map((r) => ({ questionType: typeForAi(r.type), count: r.count, pointsPerQuestion: r.pointsEach })),
    };
    const id = ++run.current;
    setBusy({ kind: 'generate', startedAt: Date.now() });
    try {
      const res = await generateQuestions({ syllabusAnalysis: analysis, pattern });
      if (id !== run.current) return;
      const qs = (res.assessment?.questions || []).map((q) => normalizeQuestion(q, { keepId: false })).filter((q) => q.text);
      if (!qs.length) {
        setError({ message: 'The AI did not return any questions. Try again or choose a different pattern.' });
        return;
      }
      setGenerated(qs);
      setSelected(new Set(qs.map((q) => q.id)));
      setGeneratedBy(res.assessment?.generatedBy || '');
      setStep(2);
    } catch (err) {
      if (id === run.current) fail(err, 'The AI could not generate questions.');
    } finally {
      if (id === run.current) setBusy(null);
    }
  };

  const cancelBusy = () => {
    run.current += 1;
    setBusy(null);
  };

  const accept = () => {
    onAccept(generated.filter((q) => selected.has(q.id)));
  };

  const fallbackUsed = /fallback/i.test(generatedBy);
  const customTotal = custom.reduce((s, r) => s + r.count, 0);
  const chosenRows = (patternOptions.find((p) => p.key === patternKey)?.rows || custom).filter((r) => r.count > 0);
  const canGenerate = chosenRows.reduce((s, r) => s + r.count, 0) > 0;

  const errorBox = error?.planLimit ? (
    <UpgradePrompt variant="inline" error={error.raw} sx={{ mb: 2 }} />
  ) : error && (
    <Alert severity="error" sx={{ mb: 2 }}>
      <AlertTitle>{error.rateLimited ? 'Slow down a little' : 'That didn’t work'}</AlertTitle>
      {error.message}
      {!error.planLimit && step === 0 && text.trim().length >= MIN_CHARS && (course?.topics || []).length > 0 && (
        <Box sx={{ mt: 1 }}>
          You can still generate questions from this course’s topics.{' '}
          <Button size="small" onClick={fallbackToCourseTopics} sx={{ ml: 0.5 }}>
            Use course topics
          </Button>
        </Box>
      )}
    </Alert>
  );

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      fullWidth
      aria-labelledby="ai-gen-title"
      PaperProps={{ sx: { minHeight: { md: 560 } } }}
    >
      <DialogTitle id="ai-gen-title" sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 6 }}>
        <AutoAwesomeRoundedIcon color="primary" />
        Generate questions with AI
        <IconButton aria-label="Close" onClick={onClose} disabled={!!busy} sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <Box sx={{ px: 3, pb: 1 }}>
        <Stepper activeStep={step} alternativeLabel>
          {STEPS.map((s) => (
            <Step key={s}>
              <StepLabel>{s}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Box>
      <DialogContent dividers>
        {busy ? (
          <Busy
            stages={busy.kind === 'analyze' ? ANALYZE_STAGES : GENERATE_STAGES}
            startedAt={busy.startedAt}
            onCancel={cancelBusy}
            label={busy.kind === 'analyze' ? 'Analysing your syllabus' : 'Generating questions'}
          />
        ) : (
          <>
            {errorBox}
            {step === 0 && (
              <Box>
                <Tabs value={sourceTab} onChange={(_, v) => setSourceTab(v)} sx={{ mb: 2 }} aria-label="Syllabus source">
                  <Tab value="upload" label="Upload a file" />
                  <Tab value="paste" label={text ? 'Review text' : 'Paste text'} />
                </Tabs>
                {sourceTab === 'upload' ? (
                  <Box
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFile(e.dataTransfer.files?.[0]);
                    }}
                    sx={(t) => ({
                      border: '2px dashed',
                      borderColor: dragOver ? 'primary.main' : 'divider',
                      bgcolor: dragOver ? alpha(t.palette.primary.main, 0.05) : 'transparent',
                      borderRadius: 4,
                      p: { xs: 3, sm: 5 },
                      textAlign: 'center',
                    })}
                  >
                    <UploadFileRoundedIcon sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} aria-hidden="true" />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      Drop your syllabus here
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
                      PDF, Word or plain text, up to 10 MB. Uploading doesn’t use AI credits.
                    </Typography>
                    <input
                      ref={fileInput}
                      type="file"
                      accept={ACCEPT}
                      hidden
                      onChange={(e) => {
                        handleFile(e.target.files?.[0]);
                        e.target.value = '';
                      }}
                    />
                    <Button variant="contained" onClick={() => fileInput.current?.click()} disabled={uploadPct !== null}>
                      Choose file
                    </Button>
                    {uploadPct !== null && (
                      <Box sx={{ mt: 2.5, maxWidth: 360, mx: 'auto' }} role="status">
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Reading {fileName}…
                        </Typography>
                        <LinearProgress variant={uploadPct < 100 ? 'determinate' : 'indeterminate'} value={uploadPct} />
                      </Box>
                    )}
                    {fileName && uploadPct === null && text && (
                      <Box sx={{ mt: 2, display: 'inline-flex', alignItems: 'center', gap: 1, color: 'success.main' }}>
                        <DescriptionOutlinedIcon fontSize="small" />
                        <Typography variant="body2">
                          {fileName} — {text.length.toLocaleString()} characters extracted
                        </Typography>
                      </Box>
                    )}
                  </Box>
                ) : (
                  <TextField
                    label="Syllabus text"
                    multiline
                    minRows={10}
                    maxRows={18}
                    fullWidth
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Paste the course outline, weekly topics and learning outcomes…"
                    helperText={`${text.length.toLocaleString()} characters${text.trim().length < MIN_CHARS ? ` — at least ${MIN_CHARS} needed` : ''}. Only the first 8,000 are analysed.`}
                  />
                )}
              </Box>
            )}

            {step === 1 && (
              <Box sx={{ display: 'grid', gap: 3 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Focus topics
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                    {topics.length ? 'Questions are spread across the selected topics.' : 'No topics were found — the whole syllabus will be used.'}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {topics.map((t) => {
                      const on = focus.includes(t);
                      return (
                        <Chip
                          key={t}
                          label={t}
                          color={on ? 'primary' : 'default'}
                          variant={on ? 'filled' : 'outlined'}
                          onClick={() => setFocus((f) => (on ? f.filter((x) => x !== t) : [...f, t]))}
                          aria-pressed={on}
                          sx={{ maxWidth: '100%' }}
                        />
                      );
                    })}
                  </Box>
                </Box>
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Assessment pattern
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 150 }}>
                      <InputLabel id="ai-difficulty">Difficulty</InputLabel>
                      <Select labelId="ai-difficulty" label="Difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                        {DIFFICULTIES.map((d) => (
                          <MenuItem key={d} value={d}>
                            {d}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' } }}>
                    {patternOptions.map((p) => (
                      <PatternCard
                        key={p.key}
                        selected={patternKey === p.key}
                        onSelect={() => setPatternKey(p.key)}
                        title={p.title}
                        description={p.description}
                        rows={p.rows}
                        badge={p.ai ? <ToneChip label="From your syllabus" tone="primary" /> : p.recommended ? <ToneChip label="Popular" tone="secondary" /> : null}
                        meta={`${p.rows.reduce((s, r) => s + r.count, 0)} questions · ${p.rows.reduce((s, r) => s + r.count * r.pointsEach, 0)} points`}
                      />
                    ))}
                    <PatternCard
                      selected={patternKey === 'custom'}
                      onSelect={() => setPatternKey('custom')}
                      title="Custom"
                      description="Choose the mix of question types yourself."
                      rows={custom.filter((r) => r.count > 0)}
                      meta={`${customTotal} questions`}
                    />
                  </Box>
                </Box>
                {patternKey === 'custom' && (
                  <Box sx={{ display: 'grid', gap: 1.5 }}>
                    {custom.map((r, i) => (
                      <Box key={i} sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr 80px 80px auto', sm: '1fr 110px 110px auto' }, alignItems: 'center' }}>
                        <FormControl size="small">
                          <Select
                            value={r.type}
                            onChange={(e) => setCustom((c) => c.map((x, j) => (j === i ? { ...x, type: e.target.value } : x)))}
                            inputProps={{ 'aria-label': `Question type for row ${i + 1}` }}
                          >
                            {QUESTION_TYPES.filter((t) => t.value !== 'multiple-select').map((t) => (
                              <MenuItem key={t.value} value={t.value}>
                                {t.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <TextField
                          size="small"
                          type="number"
                          label="Count"
                          value={r.count}
                          inputProps={{ min: 0, max: 30 }}
                          onChange={(e) =>
                            setCustom((c) => c.map((x, j) => (j === i ? { ...x, count: Math.max(0, Math.min(30, Number(e.target.value) || 0)) } : x)))
                          }
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Points"
                          value={r.pointsEach}
                          inputProps={{ min: 0, max: 100 }}
                          onChange={(e) =>
                            setCustom((c) => c.map((x, j) => (j === i ? { ...x, pointsEach: Math.max(0, Number(e.target.value) || 0) } : x)))
                          }
                        />
                        <IconButton aria-label={`Remove row ${i + 1}`} onClick={() => setCustom((c) => c.filter((_, j) => j !== i))} disabled={custom.length <= 1}>
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    ))}
                    <Box>
                      <Button size="small" startIcon={<AddRoundedIcon />} onClick={() => setCustom((c) => [...c, { type: 'multiple-choice', count: 2, pointsEach: 1 }])}>
                        Add row
                      </Button>
                    </Box>
                  </Box>
                )}
              </Box>
            )}

            {step === 2 && (
              <Box>
                {fallbackUsed && (
                  <Alert severity="warning" sx={{ mb: 2 }}>
                    The AI service was busy, so these are template questions built from your topics. Review them carefully — or go back and try again.
                  </Alert>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                  <Checkbox
                    checked={selected.size === generated.length}
                    indeterminate={selected.size > 0 && selected.size < generated.length}
                    onChange={(e) => setSelected(e.target.checked ? new Set(generated.map((q) => q.id)) : new Set())}
                    inputProps={{ 'aria-label': 'Select all generated questions' }}
                  />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {selected.size} of {generated.length} selected
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    · You can edit everything after adding.
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gap: 1.5 }}>
                  {generated.map((q, i) => {
                    const on = selected.has(q.id);
                    return (
                      <Box
                        key={q.id}
                        sx={(t) => ({
                          display: 'flex',
                          gap: 1,
                          p: 1.5,
                          borderRadius: 3,
                          border: '1px solid',
                          borderColor: on ? alpha(t.palette.primary.main, 0.5) : 'divider',
                          opacity: on ? 1 : 0.7,
                        })}
                      >
                        <Checkbox
                          checked={on}
                          onChange={() =>
                            setSelected((s) => {
                              const n = new Set(s);
                              if (n.has(q.id)) n.delete(q.id);
                              else n.add(q.id);
                              return n;
                            })
                          }
                          inputProps={{ 'aria-label': `Include question ${i + 1}` }}
                          sx={{ alignSelf: 'flex-start' }}
                        />
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }}>
                            <ToneChip label={questionTypeLabel(q.type)} />
                            <ToneChip label={`${q.points} pt${q.points === 1 ? '' : 's'}`} />
                            {q.topic && <ToneChip label={q.topic} tone="primary" />}
                            <ToneChip label={q.difficulty} />
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'pre-wrap' }}>
                            {i + 1}. {q.text}
                          </Typography>
                          {q.options.length > 0 && q.type !== 'true-false' && (
                            <Box component="ol" type="A" sx={{ pl: 3, my: 0.75 }}>
                              {q.options.map((o) => {
                                const correct = Array.isArray(q.correctAnswer) ? q.correctAnswer.includes(o) : q.correctAnswer === o;
                                return (
                                  <Typography
                                    component="li"
                                    variant="body2"
                                    key={o}
                                    sx={{ color: correct ? 'success.main' : 'text.secondary', fontWeight: correct ? 700 : 400 }}
                                  >
                                    {o}
                                    {correct ? ' ✓' : ''}
                                  </Typography>
                                );
                              })}
                            </Box>
                          )}
                          {(q.type === 'true-false' || q.type === 'short-answer') && (
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              Answer: {answerKeyText(q)}
                            </Typography>
                          )}
                          {['multiple-choice', 'multiple-select', 'true-false'].includes(q.type) && !q.correctAnswer && (
                            <Typography variant="caption" component="p" sx={{ color: 'warning.main', fontWeight: 600 }}>
                              No answer key — set one before publishing
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            )}
          </>
        )}
      </DialogContent>
      {!busy && (
        <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: 'wrap' }}>
          {step > 0 && (
            <Button color="inherit" onClick={() => setStep((s) => s - 1)} sx={{ mr: 'auto' }}>
              Back
            </Button>
          )}
          <Button color="inherit" onClick={onClose}>
            Cancel
          </Button>
          {step === 0 && (
            <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={analyze} disabled={text.trim().length < MIN_CHARS || uploadPct !== null}>
              Analyse syllabus
            </Button>
          )}
          {step === 1 && (
            <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={generate} disabled={!canGenerate}>
              Generate questions
            </Button>
          )}
          {step === 2 && (
            <Button variant="contained" onClick={accept} disabled={!selected.size}>
              Add {selected.size} question{selected.size === 1 ? '' : 's'}
            </Button>
          )}
        </DialogActions>
      )}
    </Dialog>
  );
}
