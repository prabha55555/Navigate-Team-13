import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as authApi from '../api/auth';
import {
  clearTokens,
  getRefreshToken,
  getToken,
  getTokenExpiry,
  onSessionExpired,
  onTokenChange,
  refreshAccessToken,
  setTokens,
} from '../api/client';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

/** Convenience: the current workspace (plan, limits, usage, branding, settings) or null. */
export const useWorkspace = () => useContext(AuthContext)?.workspace || null;

const USER_KEY = 'user';
const WORKSPACE_KEY = 'workspace';
const ROLE_KEY = 'userRole';

export const DEACTIVATED_MESSAGE = 'This account has been deactivated. Contact your workspace admin.';

// Refresh the access token this long before it expires.
const REFRESH_LEAD_MS = 60 * 1000;

const readJson = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
};

const cacheUser = (user) => {
  writeJson(USER_KEY, user);
  try {
    if (user) localStorage.setItem(ROLE_KEY, user.role);
    else localStorage.removeItem(ROLE_KEY);
  } catch {
    /* ignore */
  }
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => (getToken() ? readJson(USER_KEY) : null));
  const [workspace, setWorkspaceState] = useState(() => (getToken() ? readJson(WORKSPACE_KEY) : null));
  const [token, setToken] = useState(getToken);
  // With a cached user we render immediately and verify in the background.
  const [loading, setLoading] = useState(() => Boolean(getToken()) && !readJson(USER_KEY));
  // Shown once on the login page (e.g. "Your session expired").
  const [sessionNotice, setSessionNotice] = useState('');
  // True once the server has confirmed the cached user (role may have changed since it was cached).
  // Role-gated screens wait for this before redirecting.
  const [sessionVerified, setSessionVerified] = useState(() => !getToken());

  const setUser = useCallback((user) => {
    cacheUser(user);
    setCurrentUser(user);
  }, []);

  const setWorkspace = useCallback((next) => {
    setWorkspaceState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      writeJson(WORKSPACE_KEY, value);
      return value;
    });
  }, []);

  const endSession = useCallback((notice) => {
    clearTokens();
    cacheUser(null);
    writeJson(WORKSPACE_KEY, null);
    setCurrentUser(null);
    setWorkspaceState(null);
    if (notice) setSessionNotice(notice);
  }, []);

  // Keep React state in sync with the token store (refreshes happen inside the API client).
  useEffect(() => onTokenChange(setToken), []);
  useEffect(
    () =>
      onSessionExpired((reason) =>
        endSession(reason === 'deactivated' ? DEACTIVATED_MESSAGE : 'Your session has expired. Please sign in again.')
      ),
    [endSession]
  );

  // Proactively refresh shortly before expiry so long-running pages never hit a 401.
  useEffect(() => {
    if (!token) return undefined;
    const expiry = getTokenExpiry(token);
    if (!expiry) return undefined;

    const delay = Math.max(0, expiry - Date.now() - REFRESH_LEAD_MS);
    const timer = setTimeout(refreshAccessToken, delay);

    // Background tabs throttle timers; catch up as soon as the user returns.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() > expiry - REFRESH_LEAD_MS) {
        refreshAccessToken();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [token]);

  // Other tabs signing out (or in) should be reflected here.
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === 'token' && !event.newValue && currentUser) endSession();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [currentUser, endSession]);

  const refreshMe = useCallback(async () => {
    const data = await authApi.getMe();
    if (data?.user) setUser(data.user);
    if (data?.workspace) setWorkspace(data.workspace);
    return data;
  }, [setUser, setWorkspace]);

  // Verify the stored session once on startup.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false);
      setSessionVerified(true);
      return undefined;
    }
    let cancelled = false;
    authApi
      .getMe()
      .then((data) => {
        if (cancelled || !data?.user) return;
        setUser(data.user);
        if (data.workspace) setWorkspace(data.workspace);
      })
      .catch((err) => {
        if (cancelled) return;
        // 401 that survived the refresh retry, or a deleted user: the session is gone.
        if ([401, 403, 404].includes(err.status)) endSession();
        // Network/5xx errors keep the cached user so a backend hiccup doesn't sign people out.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setSessionVerified(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [endSession, setUser, setWorkspace]);

  const startSession = useCallback(
    (data) => {
      setTokens({ token: data.token, refreshToken: data.refreshToken });
      setUser(data.user);
      setWorkspace(data.workspace || null);
      setSessionNotice('');
      setSessionVerified(true);
      return data.user;
    },
    [setUser, setWorkspace]
  );

  /** login(email, password) → user. Rejects with ApiError. */
  const login = useCallback(
    async (email, password) => startSession(await authApi.login(email, password)),
    [startSession]
  );

  /** register({ name, email, password, mode, workspaceName | code }) → user. Rejects with ApiError. */
  const register = useCallback(async (body) => startSession(await authApi.register(body)), [startSession]);

  const logout = useCallback(async () => {
    const storedRefresh = getRefreshToken();
    endSession();
    if (storedRefresh) authApi.logout(storedRefresh).catch(() => {});
  }, [endSession]);

  /** PATCH /auth/me { name?, preferences? } → user */
  const updateProfile = useCallback(
    async (body) => {
      const { user } = await authApi.updateMe(body);
      if (user) setUser(user);
      return user;
    },
    [setUser]
  );

  /** Change password and continue with the new tokens (older sessions are signed out server-side). */
  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const data = await authApi.changePassword(currentPassword, newPassword);
    setTokens({ token: data.token, refreshToken: data.refreshToken });
    return data;
  }, []);

  const clearSessionNotice = useCallback(() => setSessionNotice(''), []);

  const value = useMemo(
    () => ({
      currentUser,
      workspace,
      loading,
      sessionVerified,
      sessionNotice,
      login,
      register,
      logout,
      refreshMe,
      updateProfile,
      changePassword,
      setWorkspace,
      clearSessionNotice,
      refreshAccessToken,
    }),
    [currentUser, workspace, loading, sessionVerified, sessionNotice, login, register, logout, refreshMe, updateProfile, changePassword, setWorkspace, clearSessionNotice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
