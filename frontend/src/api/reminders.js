import { api } from './client';

export function listReminders(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.sourceType) params.set('sourceType', filters.sourceType);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/reminders${query}`);
}

export function runReminders(daysBefore) {
  return api.post('/reminders/run', { daysBefore });
}
