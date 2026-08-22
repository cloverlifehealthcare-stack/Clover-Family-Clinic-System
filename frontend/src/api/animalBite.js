import { api } from './client';

export function listForPatient(patientId) {
  return api.get(`/patients/${patientId}/animal-bite-records`);
}

export function getRecord(id) {
  return api.get(`/animal-bite-records/${id}`);
}

export function createRecord(payload) {
  return api.post('/animal-bite-records', payload);
}

export function recordDiagnosis(id, payload) {
  return api.patch(`/animal-bite-records/${id}/diagnosis`, payload);
}

export function addDose(id, payload) {
  return api.post(`/animal-bite-records/${id}/doses`, payload);
}

export function administerDose(id, doseId, payload) {
  return api.patch(`/animal-bite-records/${id}/doses/${doseId}/administer`, payload);
}

export function addRig(id, payload) {
  return api.post(`/animal-bite-records/${id}/rig`, payload);
}

export function completeRecord(id) {
  return api.post(`/animal-bite-records/${id}/complete`, {});
}

export function addEducation(id, payload) {
  return api.post(`/animal-bite-records/${id}/education`, payload);
}

export function addFollowUp(id, payload) {
  return api.post(`/animal-bite-records/${id}/follow-ups`, payload);
}

export function updateFollowUpStatus(id, followUpId, payload) {
  return api.patch(`/animal-bite-records/${id}/follow-ups/${followUpId}`, payload);
}
