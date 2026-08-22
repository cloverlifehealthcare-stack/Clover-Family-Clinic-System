import { api, apiRequestRaw } from './client';

export function listPatients(search) {
  const query = search ? `?search=${encodeURIComponent(search)}` : '';
  return api.get(`/patients${query}`);
}

export function getPatient(id) {
  return api.get(`/patients/${id}`);
}

export function updatePatient(id, payload) {
  return api.patch(`/patients/${id}`, payload);
}

/**
 * Uses apiRequestRaw (not the throwing `api.post`) because a 409 "possible duplicate" is an
 * expected, informational response here — not an error — and the caller needs the
 * possibleDuplicates list out of the body, which api.post's throw-on-!ok would discard.
 * Returns {status, data}.
 */
export function createPatient(payload) {
  return apiRequestRaw('/patients', { method: 'POST', body: payload });
}
