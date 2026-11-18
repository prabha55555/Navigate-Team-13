// Small, dependency-free formatting helpers shared by the learner pages.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Seconds -> "m:ss" (or "h:mm:ss" past an hour). */
export const formatClock = (totalSeconds) => {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

/** Seconds -> "12m 05s" style duration for summaries ("—" when unknown). */
export const formatDuration = (totalSeconds) => {
  if (totalSeconds == null || Number.isNaN(Number(totalSeconds))) return '—';
  return formatClock(totalSeconds);
};

export const formatDate = (value, opts) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, opts || { month: 'short', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

/** "3 days ago", "in 2 hours", "just now". */
export const formatRelative = (value, now = Date.now()) => {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const diff = t - now;
  const abs = Math.abs(diff);
  if (abs < MINUTE) return 'just now';
  const rtf = typeof Intl !== 'undefined' && Intl.RelativeTimeFormat ? new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }) : null;
  const pick = abs < HOUR ? ['minute', MINUTE] : abs < DAY ? ['hour', HOUR] : abs < 30 * DAY ? ['day', DAY] : ['month', 30 * DAY];
  const n = Math.round(diff / pick[1]);
  return rtf ? rtf.format(n, pick[0]) : `${Math.abs(n)} ${pick[0]}${Math.abs(n) === 1 ? '' : 's'} ${diff < 0 ? 'ago' : 'from now'}`;
};

/**
 * Time left until a due date, as a short chip label plus a tone.
 * Returns null when there is no due date.
 */
export const timeLeft = (dueDate, now = Date.now()) => {
  if (!dueDate) return null;
  const diff = new Date(dueDate).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return { label: 'Past due', tone: 'error', ms: diff };
  if (diff < HOUR) return { label: `${Math.max(1, Math.round(diff / MINUTE))} min left`, tone: 'error', ms: diff };
  if (diff < DAY) return { label: `${Math.round(diff / HOUR)} h left`, tone: 'warning', ms: diff };
  const days = Math.round(diff / DAY);
  return { label: `${days} day${days === 1 ? '' : 's'} left`, tone: days <= 2 ? 'warning' : 'default', ms: diff };
};

export const formatPercent = (value, digits = 0) =>
  value == null || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(digits).replace(/\.0+$/, '')}%`;

/** Palette tone for a percentage score. */
export const scoreTone = (pct, passing = 50) => {
  if (pct == null) return 'primary';
  if (pct >= 80) return 'success';
  if (pct >= passing) return 'primary';
  if (pct >= passing - 15) return 'warning';
  return 'error';
};

export const pluralize = (n, word, plural) => `${n} ${n === 1 ? word : plural || `${word}s`}`;

/** Whether an answer value counts as answered. */
export const isAnswered = (value) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

/** Human copy for the `myStatus.reason` / 409 `details.reason` values. */
export const REASON_COPY = {
  'in-progress': { title: 'Attempt in progress', short: 'In progress — resume where you left off' },
  closed: { title: 'This assessment is closed', short: 'Closed by your instructor' },
  'not-yet-available': { title: 'Not open yet', short: 'Opens soon' },
  'past-due': { title: 'The due date has passed', short: 'Past due' },
  'no-attempts-left': { title: 'No attempts left', short: 'All attempts used' },
  'deadline-passed': { title: 'Time is up', short: 'Time is up' },
};
