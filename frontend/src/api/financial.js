import { api } from './client';

function rangeQuery({ startDate, endDate }) {
  const params = new URLSearchParams({ startDate, endDate });
  return params.toString();
}

export function getSalesJournal(range) {
  return api.get(`/financial/sales-journal?${rangeQuery(range)}`);
}

export function getPurchases(range) {
  return api.get(`/financial/purchases?${rangeQuery(range)}`);
}

export function listServiceFees() {
  return api.get('/financial/service-fees');
}

export function updateServiceFee(sourceType, doctorFee) {
  return api.put(`/financial/service-fees/${sourceType}`, { doctorFee });
}

export function getSummary(range) {
  return api.get(`/financial/summary?${rangeQuery(range)}`);
}

export function listExpenses(filters = {}) {
  const params = new URLSearchParams();
  if (filters.startDate) params.set('startDate', filters.startDate);
  if (filters.endDate) params.set('endDate', filters.endDate);
  if (filters.category) params.set('category', filters.category);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api.get(`/financial/expenses${query}`);
}

export function createExpense(input) {
  return api.post('/financial/expenses', input);
}

export function voidExpense(id, reason) {
  return api.post(`/financial/expenses/${id}/void`, { reason });
}
