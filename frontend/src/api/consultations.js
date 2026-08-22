import { api } from './client';

export function listForPatient(patientId) {
  return api.get(`/patients/${patientId}/consultations`);
}

export function getConsultation(id) {
  return api.get(`/consultations/${id}`);
}

export function createConsultation(payload) {
  return api.post('/consultations', payload);
}

export function recordDiagnosis(id, payload) {
  return api.patch(`/consultations/${id}/diagnosis`, payload);
}

export function issuePrescription(id, payload) {
  return api.post(`/consultations/${id}/prescriptions`, payload);
}

export function completeConsultation(id) {
  return api.post(`/consultations/${id}/complete`, {});
}

export function addEducation(id, payload) {
  return api.post(`/consultations/${id}/education`, payload);
}

export function addFollowUp(id, payload) {
  return api.post(`/consultations/${id}/follow-ups`, payload);
}

export function updateFollowUpStatus(id, followUpId, payload) {
  return api.patch(`/consultations/${id}/follow-ups/${followUpId}`, payload);
}
