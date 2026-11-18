import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Loads data with `loader()` and re-runs when `deps` change.
 * Returns { data, error, loading, reload, setData }. Stale responses (from an
 * earlier run, or after unmount) are ignored. `reload({ silent: true })` keeps
 * the current data on screen while refreshing.
 */
export default function useApiData(loader, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: enabled });
  const runId = useRef(0);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const run = useCallback(
    ({ silent = false } = {}) => {
      const id = ++runId.current;
      setState((s) => ({ data: silent ? s.data : null, error: null, loading: !silent }));
      return Promise.resolve()
        .then(() => loaderRef.current())
        .then((data) => {
          if (id === runId.current) setState({ data, error: null, loading: false });
          return data;
        })
        .catch((error) => {
          if (id === runId.current) setState((s) => ({ data: silent ? s.data : null, error, loading: false }));
          return undefined;
        });
    },
    []
  );

  useEffect(() => {
    if (!enabled) return undefined;
    run();
    return () => {
      runId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: run, setData };
}

/** Debounces a value (search boxes). */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
