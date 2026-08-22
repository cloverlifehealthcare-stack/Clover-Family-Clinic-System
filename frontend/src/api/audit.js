import { api, apiRequestText } from './client';

function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.userId) params.set('userId', filters.userId);
  return params.toString();
}

export function listAuditLogs(filters) {
  const query = buildQuery(filters);
  return api.get(`/audit-logs${query ? `?${query}` : ''}`);
}

export function listEntityTypes() {
  return api.get('/audit-logs/entity-types');
}

// Not routed through api.get — the response is CSV, not JSON.
export function exportAuditLogsCsv(filters) {
  const query = buildQuery(filters);
  return apiRequestText(`/audit-logs/export${query ? `?${query}` : ''}`, { method: 'GET' });
}
