import axios from 'axios';

// ---------------------------------------------------------------------------
// Session token storage (shared by the API client and AuthContext).
// ---------------------------------------------------------------------------
export const TOKEN_KEY = 'token';
export const REFRESH_KEY = 'refreshToken';

const safeGet = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const safeSet = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session lives in memory only */
  }
};

let memoryToken = safeGet(TOKEN_KEY);
let memoryRefresh = safeGet(REFRESH_KEY);

export const getToken = () => memoryToken;
export const getRefreshToken = () => memoryRefresh;

const tokenListeners = new Set();
const expiredListeners = new Set();

/** Subscribe to access-token changes. Returns an unsubscribe function. */
export const onTokenChange = (fn) => {
  tokenListeners.add(fn);
  return () => tokenListeners.delete(fn);
};

/**
 * Subscribe to the session ending server-side. The listener receives a reason:
 * 'expired' (refresh token rejected) or 'deactivated' (account deactivated by an admin).
 * Returns an unsubscribe function.
 */
export const onSessionExpired = (fn) => {
  expiredListeners.add(fn);
  return () => expiredListeners.delete(fn);
};

export const setTokens = ({ token, refreshToken } = {}) => {
  if (token !== undefined) {
    memoryToken = token || null;
    safeSet(TOKEN_KEY, memoryToken);
  }
  if (refreshToken !== undefined) {
    memoryRefresh = refreshToken || null;
    safeSet(REFRESH_KEY, memoryRefresh);
  }
  tokenListeners.forEach((fn) => fn(memoryToken));
};

export const clearTokens = () => setTokens({ token: null, refreshToken: null });

/** Milliseconds since epoch at which a JWT expires, or null if unreadable. */
export const getTokenExpiry = (jwt) => {
  try {
    const payload = JSON.parse(atob(jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
};

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class ApiError extends Error {
  constructor({ status = 0, code = 'NETWORK_ERROR', message = 'Something went wrong', details = null, requestId = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }

  get isPlanLimit() {
    return this.code === 'PLAN_LIMIT' || this.code === 'CONTACT_SALES';
  }
}

const STATUS_CODES = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  402: 'PLAN_LIMIT',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  422: 'VALIDATION_ERROR',
  429: 'RATE_LIMITED',
  500: 'INTERNAL',
  503: 'SERVICE_UNAVAILABLE'
};

const FRIENDLY = {
  NETWORK_ERROR: "Can't reach Navigate. Check your connection and try again.",
  TIMEOUT: 'The request took too long. Please try again.',
  INTERNAL: 'Something went wrong on our side. Please try again.',
  SERVICE_UNAVAILABLE: 'Navigate is temporarily unavailable. Please try again in a moment.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.'
};

/** Normalise any thrown value (axios error, ApiError, Error) to an ApiError. */
export const toApiError = (err) => {
  if (err instanceof ApiError) return err;
  if (axios.isCancel?.(err) || err?.code === 'ERR_CANCELED') {
    return new ApiError({ status: 0, code: 'CANCELED', message: 'Request cancelled' });
  }
  const response = err?.response;
  if (!response) {
    const timeout = err?.code === 'ECONNABORTED' || err?.code === 'ETIMEDOUT';
    const code = timeout ? 'TIMEOUT' : 'NETWORK_ERROR';
    return new ApiError({ status: 0, code, message: FRIENDLY[code] });
  }
  const { status, data, headers } = response;
  const body = data && typeof data === 'object' && !(data instanceof Blob) ? data : {};
  const code = body.error?.code || STATUS_CODES[status] || (status >= 500 ? 'INTERNAL' : 'ERROR');
  const message =
    body.error?.message || body.message || FRIENDLY[code] || `Request failed (${status})`;
  return new ApiError({
    status,
    code,
    message,
    details: body.error?.details || null,
    requestId: headers?.['x-request-id'] || null
  });
};

/** A short human message for any error. */
export const errorMessage = (err, fallback = 'Something went wrong') => toApiError(err).message || fallback;

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------
const api = axios.create({ baseURL: '/api', timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token && !config.headers['x-auth-token']) {
    config.headers['x-auth-token'] = token;
  }
  return config;
});

let refreshPromise = null;

/**
 * Single-flight access-token refresh. Resolves true when a new token was stored.
 * A rejected refresh token (401/403) ends the session and fires onSessionExpired;
 * a network failure keeps the session (the user may just be offline).
 */
export const refreshAccessToken = () => {
  if (refreshPromise) return refreshPromise;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return Promise.resolve(false);

  refreshPromise = axios
    .post('/api/auth/refresh-token', { refreshToken }, { timeout: 15000 })
    .then((res) => {
      setTokens({ token: res.data.token });
      return true;
    })
    .catch((err) => {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        clearTokens();
        const reason = err.response?.data?.error?.code === 'ACCOUNT_DEACTIVATED' ? 'deactivated' : 'expired';
        expiredListeners.forEach((fn) => fn(reason));
      }
      return false;
    })
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
};

// Public auth calls never trigger a token refresh (a failed login is a 401). Authenticated
// /auth calls (/auth/me, /auth/change-password) do.
const isPublicAuthPath = (url = '') =>
  /^\/?(api\/)?auth\/(login|register|refresh-token|logout|forgot-password|reset-password|invite\/)/.test(
    url.replace(/^https?:\/\/[^/]+/, '')
  );

const endSessionFor = (reason) => {
  clearTokens();
  expiredListeners.forEach((fn) => fn(reason));
};

api.interceptors.response.use(
  (response) => response,
  async (err) => {
    const original = err.config || {};
    const status = err.response?.status;
    const code = err.response?.data?.error?.code;

    // A deactivated account can't be refreshed back to life: end the session with a clear notice.
    if (status === 401 && code === 'ACCOUNT_DEACTIVATED' && !isPublicAuthPath(original.url) && getToken()) {
      endSessionFor('deactivated');
      return Promise.reject(toApiError(err));
    }

    // 304 Not Modified must never reach a page as an error: retry once, bypassing every cache.
    if (status === 304 && !original._noCacheRetry) {
      original._noCacheRetry = true;
      original.params = { ...(original.params || {}), _ts: Date.now() };
      original.headers = { ...original.headers, 'Cache-Control': 'no-cache', Pragma: 'no-cache', 'If-None-Match': '', 'If-Modified-Since': '' };
      return api(original);
    }

    if (status === 401 && !original._retry && !isPublicAuthPath(original.url) && getRefreshToken()) {
      original._retry = true;
      if (await refreshAccessToken()) {
        original.headers = { ...original.headers, 'x-auth-token': getToken() };
        return api(original);
      }
    }
    // Blob responses carry JSON errors as a Blob; decode so callers get the message.
    if (err.response?.data instanceof Blob && /json/.test(err.response.data.type || '')) {
      try {
        err.response.data = JSON.parse(await err.response.data.text());
      } catch {
        /* keep original */
      }
    }
    return Promise.reject(toApiError(err));
  }
);

/** Await an axios promise and return `response.data`. Errors are ApiError. */
export const getData = (promise) => promise.then((res) => res.data);

/** Save a Blob response as a file download. */
export const saveBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

/** Filename from a Content-Disposition header, or a fallback. */
export const filenameFrom = (headers, fallback) => {
  const cd = headers?.['content-disposition'] || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  return m ? decodeURIComponent(m[1]) : fallback;
};

export default api;
