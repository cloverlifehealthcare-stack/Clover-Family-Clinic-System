import { api } from './client';

export function listAppointments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.date) params.set('date', filters.date);
  if (filters.status) params.set('status', filters.status);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/appointments${query}`);
}

export function getAppointment(id) {
  return api.get(`/appointments/${id}`);
}

export function createAppointment(payload) {
  return api.post('/appointments', payload);
}

export function updateAppointment(id, payload) {
  return api.patch(`/appointments/${id}`, payload);
}

export function checkIn(id) {
  return api.post(`/appointments/${id}/check-in`, {});
}

export function complete(id) {
  return api.post(`/appointments/${id}/complete`, {});
}

export function cancel(id) {
  return api.post(`/appointments/${id}/cancel`, {});
}

export function markNoShow(id) {
  return api.post(`/appointments/${id}/no-show`, {});
}

export function listDoctors() {
  return api.get('/users/doctors');
}
