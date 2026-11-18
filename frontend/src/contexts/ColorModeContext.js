import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider } from '@mui/material/styles';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createAppTheme } from '../theme';
import { useAuth } from './AuthContext';

/**
 * Colour mode: 'light' | 'dark' | 'system'.
 * Signed-in users: persisted to user.preferences.theme (PATCH /api/auth/me).
 * Everyone: mirrored to localStorage so public pages and first paint match.
 */
const STORAGE_KEY = 'nv-theme';
const MODES = ['light', 'dark', 'system'];

const ColorModeContext = createContext({
  mode: 'system',
  resolvedMode: 'light',
  setMode: () => {},
  toggleMode: () => {},
});

export const useColorMode = () => useContext(ColorModeContext);

const readStored = () => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
};

const systemPrefersDark = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export const ColorModeProvider = ({ children }) => {
  const { currentUser, updateProfile } = useAuth();
  const userPref = currentUser?.preferences?.theme;
  const [mode, setModeState] = useState(() => (MODES.includes(userPref) ? userPref : readStored() || 'system'));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Follow the OS setting while in 'system' mode.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return undefined;
    const onChange = (e) => setSystemDark(e.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  // When someone signs in (or their profile loads), adopt their saved preference.
  useEffect(() => {
    if (MODES.includes(userPref)) setModeState(userPref);
  }, [userPref]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  }, [mode]);

  const resolvedMode = mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;

  // Expose the mode to plain CSS (styles/index.css) and the browser chrome.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedMode;
    root.style.colorScheme = resolvedMode;
    root.style.backgroundColor = resolvedMode === 'dark' ? '#0A1022' : '#F6F5F1';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedMode === 'dark' ? '#0A1022' : '#F6F5F1');
  }, [resolvedMode]);

  const setMode = useCallback(
    (next) => {
      if (!MODES.includes(next)) return;
      setModeState(next);
      if (currentUser && currentUser.preferences?.theme !== next) {
        updateProfile({ preferences: { ...(currentUser.preferences || {}), theme: next } }).catch(() => {
          /* the local choice still applies; it just won't follow them to another device */
        });
      }
    },
    [currentUser, updateProfile]
  );

  const toggleMode = useCallback(() => setMode(resolvedMode === 'dark' ? 'light' : 'dark'), [resolvedMode, setMode]);

  const theme = useMemo(() => createAppTheme(resolvedMode), [resolvedMode]);
  const value = useMemo(() => ({ mode, resolvedMode, setMode, toggleMode }), [mode, resolvedMode, setMode, toggleMode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
