import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';
const ROLE_KEY = 'userRole';
const USER_KEY = 'user';

// Refresh the access token this long before it expires.
const REFRESH_LEAD_MS = 60 * 1000;
const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh-token', '/api/auth/logout'];

const readStoredUser = () => {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// Milliseconds since epoch at which a JWT expires, or null if unreadable.
const getTokenExpiry = (jwt) => {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

const storeSession = (token, refreshToken, user) => {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(ROLE_KEY, user.role);
  }
};

const clearSession = () => {
  [TOKEN_KEY, REFRESH_KEY, ROLE_KEY, USER_KEY].forEach((key) => localStorage.removeItem(key));
};

// Attach the current token to every axios request. Reading localStorage at request
// time (instead of a default header set in an effect) avoids a race where child
// components fire requests before the provider's effects have run.
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token && !config.headers['x-auth-token']) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(readStoredUser);
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  // With a cached user we can render immediately and verify in the background.
  const [loading, setLoading] = useState(() => Boolean(localStorage.getItem(TOKEN_KEY)) && !readStoredUser());
  const [error, setError] = useState('');
  const refreshPromiseRef = useRef(null);

  const endSession = useCallback((message) => {
    clearSession();
    setToken(null);
    setCurrentUser(null);
    if (message) setError(message);
  }, []);

  // Single-flight refresh: concurrent 401s share one refresh request.
  const refreshAccessToken = useCallback(() => {
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    if (!storedRefresh) return Promise.resolve(false);

    refreshPromiseRef.current = axios
      .post('/api/auth/refresh-token', { refreshToken: storedRefresh })
      .then((response) => {
        storeSession(response.data.token);
        setToken(response.data.token);
        return true;
      })
      .catch((err) => {
        // Only a rejected refresh token ends the session; a network blip should not.
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          endSession('Your session has expired. Please log in again.');
        }
        return false;
      })
      .finally(() => {
        refreshPromiseRef.current = null;
      });

    return refreshPromiseRef.current;
  }, [endSession]);

  // Retry a request once after refreshing when the server says the token expired.
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (err) => {
        const original = err.config || {};
        const status = err.response?.status;
        const isAuthCall = AUTH_ENDPOINTS.some((path) => (original.url || '').includes(path));

        if (status === 401 && !original._retry && !isAuthCall && localStorage.getItem(REFRESH_KEY)) {
          original._retry = true;
          if (await refreshAccessToken()) {
            original.headers = { ...original.headers, 'x-auth-token': localStorage.getItem(TOKEN_KEY) };
            return axios(original);
          }
        }
        return Promise.reject(err);
      }
    );
    return () => axios.interceptors.response.eject(interceptor);
  }, [refreshAccessToken]);

  // Proactively refresh shortly before expiry so fetch() callers that read the
  // token from localStorage always get a valid one.
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
  }, [token, refreshAccessToken]);

  // Verify the stored session once on startup.
  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    axios
      .get('/api/auth/me')
      .then((res) => {
        if (cancelled || !res.data?.user) return;
        storeSession(null, null, res.data.user);
        setCurrentUser(res.data.user);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        // 401 that survived the refresh retry, or a deleted user: the session is gone.
        if (status === 401 || status === 403 || status === 404) {
          endSession();
        }
        // Network/5xx errors keep the cached user so a backend hiccup doesn't log people out.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [endSession]);

  const startSession = useCallback((data) => {
    const { token: authToken, refreshToken: authRefreshToken, user } = data;
    storeSession(authToken, authRefreshToken, user);
    setToken(authToken);
    setCurrentUser(user);
    setError('');
    return user;
  }, []);

  const register = useCallback(async (name, email, password, role = 'student') => {
    try {
      setError('');
      const response = await axios.post('/api/auth/register', { name, email, password, role });
      return startSession(response.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Registration failed. Is the server running?';
      setError(message);
      throw new Error(message);
    }
  }, [startSession]);

  const login = useCallback(async (email, password) => {
    try {
      setError('');
      const response = await axios.post('/api/auth/login', { email, password });
      return startSession(response.data);
    } catch (err) {
      const message = err.response?.data?.message || 'Login failed. Is the server running?';
      setError(message);
      throw new Error(message);
    }
  }, [startSession]);

  const logout = useCallback(async () => {
    const storedRefresh = localStorage.getItem(REFRESH_KEY);
    endSession();
    if (storedRefresh) {
      // Fire and forget: the local session is already cleared.
      axios.post('/api/auth/logout', { refreshToken: storedRefresh }).catch(() => {});
    }
  }, [endSession]);

  const value = useMemo(
    () => ({ currentUser, loading, error, register, login, logout, refreshAccessToken }),
    [currentUser, loading, error, register, login, logout, refreshAccessToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
