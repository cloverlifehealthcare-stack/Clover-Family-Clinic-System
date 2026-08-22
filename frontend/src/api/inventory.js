import { api } from './client';

export function listItems(activeOnly = true) {
  return api.get(`/inventory?activeOnly=${activeOnly}`);
}

export function getItem(id) {
  return api.get(`/inventory/${id}`);
}

export function createItem(payload) {
  return api.post('/inventory', payload);
}

export function updateItem(id, payload) {
  return api.patch(`/inventory/${id}`, payload);
}

export function receiveBatch(itemId, payload) {
  return api.post(`/inventory/${itemId}/batches`, payload);
}

export function adjustBatch(batchId, payload) {
  return api.post(`/inventory/batches/${batchId}/adjustments`, payload);
}

export function getAlerts(expiringWithinDays = 30) {
  return api.get(`/inventory/alerts?expiringWithinDays=${expiringWithinDays}`);
}
