/*
 * Shared helpers for the staff (instructor/admin/owner) screens: formatting,
 * status metadata, question types and client-side mirrors of the backend's
 * question rules (backend/services/questions.js) so problems show up while editing.
 */

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------
const dateFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const dateShortFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
const relFmt = typeof Intl.RelativeTimeFormat === 'function' ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;

const toDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? dateFmt.format(d) : fallback;
};

export const formatShortDate = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? dateShortFmt.format(d) : fallback;
};

export const formatDateTime = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? dateTimeFmt.format(d) : fallback;
};

export const formatTime = (value, fallback = '—') => {
  const d = toDate(value);
  return d ? timeFmt.format(d) : fallback;
};

/** "in 3 days", "2 hours ago" … */
export const formatRelative = (value, fallback = '—') => {
  const d = toDate(value);
  if (!d) return fallback;
  const diff = (d.getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (!relFmt) return formatDateTime(d);
  if (abs < 45) return 'just now';
  if (abs < 3600) return relFmt.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return relFmt.format(Math.round(diff / 3600), 'hour');
  if (abs < 86400 * 30) return relFmt.format(Math.round(diff / 86400), 'day');
  return formatDate(d);
};

/** Seconds → "24m 10s" / "1h 05m". */
export const formatDuration = (seconds, fallback = '—') => {
  if (seconds === null || seconds === undefined || !Number.isFinite(Number(seconds))) return fallback;
  const s = Math.max(0, Math.round(Number(seconds)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
};

export const formatPercent = (value, fallback = '—', digits = 0) => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  return `${Number(value).toFixed(digits)}%`;
};

export const formatNumber = (value, fallback = '—') => {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return fallback;
  return new Intl.NumberFormat().format(Number(value));
};

export const firstName = (name = '') => String(name).trim().split(/\s+/)[0] || '';

export const initials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] || '')
    .join('')
    .toUpperCase();

export const pluralize = (count, singular, plural = `${singular}s`) => `${count} ${count === 1 ? singular : plural}`;

/** ISO string → value for <input type="datetime-local"> in local time. */
export const toLocalInput = (value) => {
  const d = toDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** <input type="datetime-local"> value → ISO string (or null when empty). */
export const fromLocalInput = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

// ---------------------------------------------------------------------------
// Score colouring
// ---------------------------------------------------------------------------
/** Palette key for a percentage against a pass mark. */
export const scoreTone = (percentage, passingScore = 50) => {
  if (percentage === null || percentage === undefined) return 'default';
  if (percentage >= Math.max(passingScore, 80)) return 'success';
  if (percentage >= passingScore) return 'info';
  return 'error';
};

// ---------------------------------------------------------------------------
// Assessment status
// ---------------------------------------------------------------------------
export const ASSESSMENT_STATUS = {
  draft: { label: 'Draft', tone: 'default' },
  published: { label: 'Published', tone: 'success' },
  closed: { label: 'Closed', tone: 'warning' },
  archived: { label: 'Archived', tone: 'default' },
};

export const SUBMISSION_STATUS = {
  'in-progress': { label: 'In progress', tone: 'info' },
  submitted: { label: 'Submitted', tone: 'success' },
  terminated: { label: 'Terminated', tone: 'error' },
};

export const RESULTS_POLICIES = [
  { value: 'immediate', label: 'Immediately after submitting', hint: 'Students see their score as soon as they submit.' },
  { value: 'after-due', label: 'After the due date', hint: 'Scores appear once the due date has passed.' },
  { value: 'manual', label: 'When I release them', hint: 'Nothing is shown until you click “Release results”.' },
];

export const AT_RISK_REASONS = {
  'low-average': { label: 'Low average', tone: 'warning' },
  'terminated-attempt': { label: 'Terminated attempt', tone: 'error' },
};

export const INTEGRITY_EVENTS = {
  fullscreen_exit: 'Left full screen',
  blocked_shortcut: 'Blocked shortcut',
  camera_lost: 'Camera lost',
  tab_hidden: 'Switched tab / window',
  paste: 'Pasted text',
  copy: 'Copied text',
  window_blur: 'Window lost focus',
  devtools: 'Developer tools opened',
};

export const integrityLabel = (type) =>
  INTEGRITY_EVENTS[type] || String(type || 'Event').replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

// ---------------------------------------------------------------------------
// Questions
// ---------------------------------------------------------------------------
export const QUESTION_TYPES = [
  { value: 'multiple-choice', label: 'Multiple choice', short: 'MC' },
  { value: 'multiple-select', label: 'Multiple select', short: 'MS' },
  { value: 'true-false', label: 'True / False', short: 'T/F' },
  { value: 'short-answer', label: 'Short answer', short: 'SA' },
  { value: 'essay', label: 'Essay', short: 'Essay' },
];

export const questionTypeLabel = (type) => QUESTION_TYPES.find((t) => t.value === type)?.label || type;

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];
export const BLOOM_LEVELS = ['Remember', 'Understand', 'Apply', 'Analyze', 'Evaluate', 'Create'];

export const OBJECTIVE_TYPES = ['multiple-choice', 'multiple-select', 'true-false'];
export const isObjective = (type) => OBJECTIVE_TYPES.includes(type);

/** Question ids must match ^[A-Za-z0-9_-]{1,64}$ (they become answer keys). */
export const newQuestionId = () => `q${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const blankQuestion = (type = 'multiple-choice', defaults = {}) => {
  const base = {
    id: newQuestionId(),
    type,
    text: '',
    options: [],
    correctAnswer: null,
    points: 1,
    topic: '',
    difficulty: 'Medium',
    bloomLevel: '',
    explanation: '',
    ...defaults,
  };
  return withTypeDefaults(base, type);
};

/** Adjusts options/answer key when a question changes type. */
export const withTypeDefaults = (q, type) => {
  const next = { ...q, type };
  if (type === 'true-false') {
    next.options = ['True', 'False'];
    next.correctAnswer = q.correctAnswer === 'True' || q.correctAnswer === 'False' ? q.correctAnswer : null;
  } else if (type === 'multiple-choice' || type === 'multiple-select') {
    const opts = (q.options || []).filter((o) => o !== 'True' && o !== 'False' && o !== undefined);
    next.options = opts.length >= 2 ? opts : ['', '', '', ''].map((_, i) => opts[i] || '');
    const keys = (Array.isArray(q.correctAnswer) ? q.correctAnswer : q.correctAnswer ? [q.correctAnswer] : []).filter((k) =>
      next.options.includes(k)
    );
    next.correctAnswer = type === 'multiple-select' ? (keys.length ? keys : null) : keys[0] ?? null;
  } else {
    next.options = [];
    if (type === 'short-answer') {
      const accepted = (Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer]).filter(
        (k) => typeof k === 'string' && k.trim() && !isObjective(q.type)
      );
      next.correctAnswer = accepted.length > 1 ? accepted : accepted[0] || null;
    } else {
      next.correctAnswer = typeof q.correctAnswer === 'string' && !isObjective(q.type) ? q.correctAnswer : null;
    }
  }
  return next;
};

const TYPE_ALIASES = {
  mcq: 'multiple-choice',
  'multiple choice': 'multiple-choice',
  multiplechoice: 'multiple-choice',
  'multiple-choice': 'multiple-choice',
  'multiple select': 'multiple-select',
  'multiple-select': 'multiple-select',
  checkbox: 'multiple-select',
  'true/false': 'true-false',
  'true-false': 'true-false',
  'true false': 'true-false',
  truefalse: 'true-false',
  boolean: 'true-false',
  'short answer': 'short-answer',
  'short-answer': 'short-answer',
  shortanswer: 'short-answer',
  essay: 'essay',
  'long answer': 'essay',
};

export const normalizeType = (raw) => {
  const v = String(raw || '').trim().toLowerCase().replace(/_/g, '-');
  return TYPE_ALIASES[v] || TYPE_ALIASES[v.replace(/-/g, ' ')] || 'multiple-choice';
};

const resolveOption = (value, options) => {
  if (value === null || value === undefined || value === '') return undefined;
  const text = String(value).trim();
  const exact = options.find((o) => o.toLowerCase() === text.toLowerCase());
  if (exact !== undefined) return exact;
  if (/^[A-Ja-j]$/.test(text)) return options[text.toUpperCase().charCodeAt(0) - 65];
  if (typeof value === 'number' || /^\d+$/.test(text)) return options[Number(text)];
  return undefined;
};

/**
 * Turns a question from any source (AI generator, question bank, API) into the
 * editor shape: { id, type, text, options, correctAnswer, points, topic, difficulty, bloomLevel, explanation }.
 */
export const normalizeQuestion = (raw = {}, { keepId = true } = {}) => {
  const type = normalizeType(raw.type || raw.questionType);
  let options = [];
  if (type === 'true-false') options = ['True', 'False'];
  else if (type === 'multiple-choice' || type === 'multiple-select') {
    options = (Array.isArray(raw.options) ? raw.options : [])
      .map((o) => (typeof o === 'object' && o !== null ? o.text ?? o.label ?? '' : String(o ?? '')).trim())
      .map((o) => o.replace(/^[A-J][).:]\s+/, ''))
      .filter(Boolean)
      .slice(0, 10);
  }
  let correctAnswer = null;
  const key = raw.correctAnswer ?? raw.answer ?? null;
  if (type === 'multiple-choice') correctAnswer = resolveOption(key, options) ?? null;
  else if (type === 'multiple-select') {
    const keys = (Array.isArray(key) ? key : key === null ? [] : [key]).map((k) => resolveOption(k, options)).filter(Boolean);
    correctAnswer = keys.length ? [...new Set(keys)] : null;
  } else if (type === 'true-false') {
    const v = String(key ?? '').trim().toLowerCase();
    correctAnswer = v === 'true' || v === 't' ? 'True' : v === 'false' || v === 'f' ? 'False' : null;
  } else if (type === 'short-answer') {
    const accepted = (Array.isArray(key) ? key : [key]).filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim());
    correctAnswer = accepted.length > 1 ? accepted : accepted[0] || null;
  } else if (typeof key === 'string' && key.trim()) correctAnswer = key.trim();

  const points = Number(raw.points);
  const id = keepId && /^[A-Za-z0-9_-]{1,64}$/.test(String(raw.id || '')) ? String(raw.id) : newQuestionId();
  const difficulty = DIFFICULTIES.find((d) => d.toLowerCase() === String(raw.difficulty || '').toLowerCase()) || 'Medium';
  return {
    id,
    type,
    text: String(raw.text || raw.question || '').trim(),
    options,
    correctAnswer,
    points: Number.isFinite(points) && points >= 0 ? points : 1,
    topic: String(raw.topic || '').trim(),
    difficulty,
    bloomLevel: String(raw.bloomLevel || '').trim(),
    explanation: String(raw.explanation || '').trim(),
  };
};

/** Fields the API accepts for a question (drops client-only keys). */
export const toApiQuestion = (q) => ({
  id: q.id,
  type: q.type,
  text: q.text,
  options: q.type === 'multiple-choice' || q.type === 'multiple-select' ? (q.options || []).map((o) => o.trim()).filter(Boolean) : q.options || [],
  correctAnswer: q.correctAnswer,
  points: Number(q.points) || 0,
  topic: q.topic || '',
  difficulty: q.difficulty || 'Medium',
  bloomLevel: q.bloomLevel || '',
  explanation: q.explanation || '',
});

/** Mirrors backend `hasValidKey` (publish rule). */
export const hasValidKey = (q) => {
  const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
  if (q.type === 'multiple-choice') return !!q.correctAnswer && options.includes(q.correctAnswer);
  if (q.type === 'multiple-select') {
    return Array.isArray(q.correctAnswer) && q.correctAnswer.length > 0 && q.correctAnswer.every((k) => options.includes(k));
  }
  if (q.type === 'true-false') return q.correctAnswer === 'True' || q.correctAnswer === 'False';
  return true;
};

/**
 * Problems for one question. `errors` block saving/publishing; `warnings` are advice.
 */
export const questionIssues = (q) => {
  const errors = [];
  const warnings = [];
  if (!String(q.text || '').trim()) errors.push('Add the question text');
  if (q.type === 'multiple-choice' || q.type === 'multiple-select') {
    const options = (q.options || []).map((o) => String(o).trim()).filter(Boolean);
    if (options.length < 2) errors.push('Add at least two options');
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) errors.push('Options must be different');
  }
  if (!hasValidKey(q)) errors.push(q.type === 'multiple-select' ? 'Mark at least one correct option' : 'Mark the correct answer');
  const points = Number(q.points);
  if (!Number.isFinite(points) || points < 0) errors.push('Points must be zero or more');
  else if (points === 0) warnings.push('Worth 0 points');
  if (q.type === 'short-answer' && !q.correctAnswer) warnings.push('No accepted answers — every response will need manual review');
  if (q.type === 'essay') warnings.push('Essays are scored provisionally and flagged for your review');
  if (!q.topic) warnings.push('No topic — it will not count towards topic mastery');
  return { errors, warnings };
};

export const totalPoints = (questions = []) => questions.reduce((sum, q) => sum + (Number(q.points) || 0), 0);

/** Human summary of an answer key. */
export const answerKeyText = (q) => {
  const key = q.correctAnswer;
  if (key === null || key === undefined || key === '') return '—';
  if (Array.isArray(key)) return key.join(', ');
  return String(key);
};

/** Human summary of a student's answer. */
export const answerText = (answer) => {
  if (answer === null || answer === undefined || answer === '') return '';
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object') return JSON.stringify(answer);
  return String(answer);
};

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
/**
 * Course accent colours offered when creating a course. These are stored on the
 * course as data (like a user's chosen label colour), not used as UI chrome.
 */
export const COURSE_COLORS = [
  { value: '#4f46e5', name: 'Indigo' },
  { value: '#2563eb', name: 'Blue' },
  { value: '#0891b2', name: 'Cyan' },
  { value: '#059669', name: 'Emerald' },
  { value: '#65a30d', name: 'Lime' },
  { value: '#d97706', name: 'Amber' },
  { value: '#ea580c', name: 'Orange' },
  { value: '#dc2626', name: 'Red' },
  { value: '#db2777', name: 'Pink' },
  { value: '#7c3aed', name: 'Violet' },
  { value: '#475569', name: 'Slate' },
];

export const isHexColor = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ''));

/** Copies text; resolves true on success. */
export const copyText = async (text) => {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    el.remove();
    return ok;
  } catch {
    return false;
  }
};

export const joinUrl = (code) => `${window.location.origin}/join/${code}`;

/** Splits a pasted list of emails (commas, spaces, new lines, semicolons). */
export const parseEmails = (text) => {
  const all = String(text || '')
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const valid = [];
  const invalid = [];
  all.forEach((e) => {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      if (!valid.includes(e)) valid.push(e);
    } else invalid.push(e);
  });
  return { valid, invalid };
};
