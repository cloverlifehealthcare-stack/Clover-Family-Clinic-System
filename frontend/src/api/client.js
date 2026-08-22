const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'clover.accessToken';
const REFRESH_KEY = 'clover.refreshToken';

// Tokens live in localStorage rather than an httpOnly cookie because the backend's
// /api/auth/login returns both tokens in the JSON body (see backend/src/modules/auth) —
// there's no cookie for the browser to store instead. That's a real XSS trade-off worth
// revisiting before this goes in front of real patient data; noted in frontend/README.md.
export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) {
    localStorage.setItem(REFRESH_KEY, refreshToken);
  }
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// Set by AuthContext on mount so this module (which isn't a React component and can't use
// context directly) can force a logout when a token refresh ultimately fails.
let onSessionExpired = () => {};
export function setSessionExpiredHandler(fn) {
  onSessionExpired = fn;
}

async function rawRequest(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getAccessToken() ? { Authorization: `Bearer ${getAccessToken()}` } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  return { res, data };
}

async function tryRefresh() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return false;
  }
  const { res, data } = await rawRequest('/auth/refresh', { method: 'POST', body: { refreshToken } });
  if (!res.ok) {
    return false;
  }
  setTokens(data);
  return true;
}

/**
 * Attaches the access token, and on a 401 attempts exactly one silent refresh-and-retry
 * before giving up and forcing a logout. Every module's API calls go through this (via
 * apiRequest or apiRequestRaw below) so that logic only lives in one place. Does not throw
 * on a non-2xx status — that's apiRequest's job — because some callers (e.g. patients.js
 * handling a 409 "possible duplicate") need to inspect a specific non-2xx status themselves.
 */
async function requestWithAuth(path, options) {
  let { res, data } = await rawRequest(path, options);

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      ({ res, data } = await rawRequest(path, options));
    }
  }

  if (res.status === 401) {
    clearTokens();
    onSessionExpired();
  }

  return { status: res.status, data };
}

/** Throws on a non-2xx status. Use for the common case where any failure is just an error. */
export async function apiRequest(path, options = {}) {
  const { status, data } = await requestWithAuth(path, options);
  if (status < 200 || status >= 300) {
    throw new Error((data && data.error) || `Request failed with status ${status}`);
  }
  return data;
}

/** Never throws — returns {status, data} so the caller can handle specific status codes. */
export async function apiRequestRaw(path, options = {}) {
  return requestWithAuth(path, options);
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
  put: (path, body) => apiRequest(path, { method: 'PUT', body }),
  delete: (path) => apiRequest(path, { method: 'DELETE' }),
};
