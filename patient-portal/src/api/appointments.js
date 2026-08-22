import { api } from './client';

export function listDoctors() {
  return api.get('/patient/doctors');
}

export function listMyAppointments() {
  return api.get('/patient/appointments');
}

export function bookAppointment(payload) {
  return api.post('/patient/appointments', payload);
}

export function cancelAppointment(id) {
  return api.post(`/patient/appointments/${id}/cancel`, {});
}
