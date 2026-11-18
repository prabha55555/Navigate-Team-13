import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autosaveAnswers } from '../../api/submissions';

const DEBOUNCE_MS = 1500;
const MAX_BACKOFF_MS = 30000;

const backupKey = (submissionId) => `navigate:unsaved:${submissionId}`;

/** Answers changed locally but not yet confirmed by the server (survives a crash or reload). */
export const readUnsavedBackup = (submissionId) => {
  if (!submissionId) return null;
  try {
    const raw = JSON.parse(localStorage.getItem(backupKey(submissionId)));
    return raw && typeof raw.answers === 'object' && raw.answers ? raw.answers : null;
  } catch {
    return null;
  }
};

export const clearUnsavedBackup = (submissionId) => {
  if (!submissionId) return;
  try {
    localStorage.removeItem(backupKey(submissionId));
  } catch {
    /* storage unavailable */
  }
};

const writeBackup = (submissionId, answers) => {
  try {
    if (!Object.keys(answers).length) localStorage.removeItem(backupKey(submissionId));
    else localStorage.setItem(backupKey(submissionId), JSON.stringify({ answers, at: Date.now() }));
  } catch {
    /* storage full or blocked: the server copy is still the source of truth */
  }
};

/**
 * Debounced, retrying autosave of an in-progress attempt.
 *
 * - markDirty(questionId) after each change; a save runs ~1.5 s after the last change.
 * - flush() saves immediately (blur, navigation, before submit). Resolves true when nothing is left unsaved.
 * - Failures retry with exponential backoff (2 s → 30 s) and immediately when the browser comes back online.
 * - Unsaved answers are mirrored to localStorage so a crash never loses them.
 * - A 409 (time is up / already submitted) stops saving and calls onConflict(error).
 *
 * status: 'idle' | 'pending' | 'saving' | 'saved' | 'offline' | 'error'
 */
export default function useAutosave(submissionId, answersRef, { onConflict } = {}) {
  const dirtyRef = useRef(new Map()); // questionId -> version
  const versionRef = useRef(0);
  const timerRef = useRef(null);
  const inflightRef = useRef(null);
  const failuresRef = useRef(0);
  const stoppedRef = useRef(false);
  const onConflictRef = useRef(onConflict);
  const [state, setState] = useState({ status: 'idle', savedAt: null, unsaved: 0 });

  useEffect(() => {
    onConflictRef.current = onConflict;
  }, [onConflict]);

  const unsavedAnswers = useCallback(() => {
    const out = {};
    dirtyRef.current.forEach((_v, qid) => {
      out[qid] = answersRef.current[qid] ?? null;
    });
    return out;
  }, [answersRef]);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  };

  const flushRef = useRef(null);

  const schedule = useCallback((delay) => {
    clearTimer();
    if (stoppedRef.current) return;
    timerRef.current = setTimeout(() => flushRef.current && flushRef.current(), delay);
  }, []);

  const flush = useCallback(async () => {
    if (stoppedRef.current || !submissionId) return dirtyRef.current.size === 0;
    clearTimer();
    // One request at a time; changes made meanwhile are sent right after it.
    if (inflightRef.current) {
      await inflightRef.current;
      if (stoppedRef.current) return false;
      clearTimer();
      if (inflightRef.current) return flushRef.current();
    }
    if (dirtyRef.current.size === 0) return true;

    const snapshot = new Map(dirtyRef.current);
    const payload = {};
    snapshot.forEach((_v, qid) => {
      payload[qid] = answersRef.current[qid] ?? null;
    });
    setState((s) => ({ ...s, status: 'saving' }));

    const request = autosaveAnswers(submissionId, payload)
      .then((res) => {
        // Only clear questions that were not edited again while the request was in flight.
        snapshot.forEach((version, qid) => {
          if (dirtyRef.current.get(qid) === version) dirtyRef.current.delete(qid);
        });
        failuresRef.current = 0;
        writeBackup(submissionId, unsavedAnswers());
        const left = dirtyRef.current.size;
        setState({ status: left ? 'pending' : 'saved', savedAt: res?.savedAt || new Date().toISOString(), unsaved: left });
        if (left) schedule(DEBOUNCE_MS);
        return left === 0;
      })
      .catch((err) => {
        if (err?.status === 409) {
          stoppedRef.current = true;
          setState((s) => ({ ...s, status: 'error' }));
          if (onConflictRef.current) onConflictRef.current(err);
          return false;
        }
        failuresRef.current += 1;
        const offline = err?.status === 0 || (typeof navigator !== 'undefined' && navigator.onLine === false);
        setState((s) => ({ ...s, status: offline ? 'offline' : 'error', unsaved: dirtyRef.current.size }));
        schedule(Math.min(MAX_BACKOFF_MS, 2000 * 2 ** (failuresRef.current - 1)));
        return false;
      })
      .finally(() => {
        if (inflightRef.current === request) inflightRef.current = null;
      });
    inflightRef.current = request;
    return request;
  }, [submissionId, answersRef, unsavedAnswers, schedule]);

  flushRef.current = flush;

  const markDirty = useCallback(
    (questionId) => {
      if (stoppedRef.current) return;
      versionRef.current += 1;
      dirtyRef.current.set(questionId, versionRef.current);
      writeBackup(submissionId, unsavedAnswers());
      setState((s) => ({
        ...s,
        status: s.status === 'offline' || s.status === 'error' ? s.status : 'pending',
        unsaved: dirtyRef.current.size,
      }));
      // While failing, keep the backoff schedule instead of hammering the server.
      if (failuresRef.current === 0) schedule(DEBOUNCE_MS);
    },
    [submissionId, unsavedAnswers, schedule]
  );

  /** Mark answers restored from the local backup as needing a save. */
  const markAllDirty = useCallback(
    (questionIds) => {
      questionIds.forEach((qid) => {
        versionRef.current += 1;
        dirtyRef.current.set(qid, versionRef.current);
      });
      if (questionIds.length) schedule(300);
    },
    [schedule]
  );

  /** Stop saving (after submit/termination). Keeps nothing pending. */
  const stop = useCallback(
    ({ clearBackup = false } = {}) => {
      stoppedRef.current = true;
      clearTimer();
      if (clearBackup) clearUnsavedBackup(submissionId);
    },
    [submissionId]
  );

  // Retry immediately when the connection returns.
  useEffect(() => {
    const onOnline = () => {
      if (dirtyRef.current.size) {
        failuresRef.current = 0;
        flushRef.current && flushRef.current();
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, []);

  // Warn before closing the tab with unsaved answers.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (stoppedRef.current || dirtyRef.current.size === 0) return undefined;
      e.preventDefault();
      e.returnValue = '';
      return '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  useEffect(() => () => clearTimer(), []);

  return useMemo(
    () => ({ ...state, markDirty, markAllDirty, flush, stop, hasUnsaved: () => dirtyRef.current.size > 0 }),
    [state, markDirty, markAllDirty, flush, stop]
  );
}
