const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

const TOKEN_KEY = 'clover.patient.accessToken';
const REFRESH_KEY = 'clover.patient.refreshToken';

// Same localStorage/XSS trade-off as the staff SPA's client.js — see that file's comment and
// this app's README "Known gaps." Distinct key names (not shared with frontend/) aren't a
// security boundary on their own (different origin/port already separates them), just clarity.
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
  const { res, data } = await rawRequest('/patient-auth/refresh', { method: 'POST', body: { refreshToken } });
  if (!res.ok) {
    return false;
  }
  setTokens(data);
  return true;
}

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

export async function apiRequest(path, options = {}) {
  const { status, data } = await requestWithAuth(path, options);
  if (status < 200 || status >= 300) {
    throw new Error((data && data.message) || (data && data.error) || `Request failed with status ${status}`);
  }
  return data;
}

export async function apiRequestRaw(path, options = {}) {
  return requestWithAuth(path, options);
}

export const api = {
  get: (path) => apiRequest(path, { method: 'GET' }),
  post: (path, body) => apiRequest(path, { method: 'POST', body }),
  patch: (path, body) => apiRequest(path, { method: 'PATCH', body }),
};
