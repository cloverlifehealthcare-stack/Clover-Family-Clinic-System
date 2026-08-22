import { api, apiRequestRaw } from './client';

export function login(email, password) {
  return api.post('/patient-auth/login', { email, password });
}

// apiRequestRaw (not the throwing api.post) — a 409 possible_duplicate is an expected outcome
// the caller inspects and re-submits against (with confirmDuplicate: true), not a real error.
// Same pattern as frontend/src/api/patients.js's createPatient.
export function register(payload) {
  return apiRequestRaw('/patient-auth/register', { method: 'POST', body: payload });
}

export function logout() {
  return api.post('/patient-auth/logout', {});
}

export function getMe() {
  return api.get('/patient-auth/me');
}

export function updateMe(updates) {
  return api.patch('/patient-auth/me', updates);
}
