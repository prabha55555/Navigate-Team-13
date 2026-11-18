import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext } from 'react-router-dom';

/**
 * Warns before leaving a page with unsaved work. The app uses <BrowserRouter>
 * (no data router, so no useBlocker): in-app navigations are intercepted by
 * wrapping the router's navigator, and tab close / reload by `beforeunload`.
 *
 * Returns { blocked, proceed, cancel, bypass } — render a dialog while `blocked`;
 * `bypass(fn)` runs a navigation of your own (e.g. after saving) without prompting.
 */
export default function useNavigationGuard(when) {
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const [pending, setPending] = useState(null);
  const bypassing = useRef(false);

  useEffect(() => {
    if (!when || !navigator) return undefined;
    const { push, replace } = navigator;
    const wrap = (fn) => (...args) => {
      if (bypassing.current) return fn.apply(navigator, args);
      setPending({ fn, args });
      return undefined;
    };
    navigator.push = wrap(push);
    navigator.replace = wrap(replace);
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      navigator.push = push;
      navigator.replace = replace;
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [when, navigator]);

  const proceed = useCallback(() => {
    const p = pending;
    setPending(null);
    if (!p) return;
    bypassing.current = true;
    try {
      p.fn.apply(navigator, p.args);
    } finally {
      bypassing.current = false;
    }
  }, [navigator, pending]);

  const cancel = useCallback(() => setPending(null), []);

  const bypass = useCallback((fn) => {
    bypassing.current = true;
    try {
      fn();
    } finally {
      bypassing.current = false;
    }
  }, []);

  return { blocked: !!pending, proceed, cancel, bypass };
}
