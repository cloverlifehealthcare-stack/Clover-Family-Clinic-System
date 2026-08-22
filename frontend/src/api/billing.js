import { api } from './client';

export function listForPatient(patientId) {
  return api.get(`/patients/${patientId}/billing-statements`);
}

export function getStatement(id) {
  return api.get(`/billing/statements/${id}`);
}

export function createStatement(payload) {
  return api.post('/billing/statements', payload);
}

export function recordPayment(id, payload) {
  return api.post(`/billing/statements/${id}/payments`, payload);
}

export function voidStatement(id, payload) {
  return api.post(`/billing/statements/${id}/void`, payload);
}

export function voidPayment(paymentId, payload) {
  return api.post(`/billing/payments/${paymentId}/void`, payload);
}

export function listServices() {
  return api.get('/services');
}
