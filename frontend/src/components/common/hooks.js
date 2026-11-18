import { useCallback, useEffect, useRef, useState } from 'react';

/** Value that only updates after `delay` ms without changes (search inputs). */
export const useDebouncedValue = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
};

/**
 * Run an async loader and track { data, error, loading }. Re-runs when `deps` change;
 * `reload()` re-runs on demand; `setData` allows optimistic updates.
 * Responses from stale runs are ignored.
 */
export const useAsync = (loader, deps = [], { enabled = true } = {}) => {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const runId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(() => {
    const id = ++runId.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    return Promise.resolve()
      .then(() => loaderRef.current())
      .then(
        (data) => {
          if (id === runId.current) setState({ data, error: null, loading: false });
          return data;
        },
        (error) => {
          if (id === runId.current) setState((s) => ({ ...s, error, loading: false }));
          return undefined;
        }
      );
  }, []);

  useEffect(() => {
    if (!enabled) return;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, run, ...deps]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
};

/** True while document.visibilityState === 'visible'. */
export const usePageVisible = () => {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);
  return visible;
};

/** Copy text to the clipboard. Resolves true on success. */
export const copyToClipboard = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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
  }
};

/** "3 min ago", "yesterday", "12 Mar". */
export const timeAgo = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  const diff = (Date.now() - date.getTime()) / 1000;
  if (Number.isNaN(diff)) return '';
  if (diff < 45) return 'just now';
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} min ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h ago`;
  if (diff < 172800) return 'yesterday';
  if (diff < 7 * 86400) return `${Math.round(diff / 86400)} days ago`;
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};
