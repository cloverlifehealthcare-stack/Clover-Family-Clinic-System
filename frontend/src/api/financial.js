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

export function listVaccineCosts() {
  return api.get('/financial/vaccine-costs');
}

export function updateVaccineCost(itemId, currentCost) {
  return api.put(`/financial/vaccine-costs/${itemId}`, { currentCost });
}

export function listDoctorFees() {
  return api.get('/financial/doctor-fees');
}

export function updateDoctorFee(userId, feeAmount) {
  return api.put(`/financial/doctor-fees/${userId}`, { feeAmount });
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

export function listCashDisbursements(range) {
  return api.get(`/financial/cash-disbursements?${rangeQuery(range)}`);
}

export function createCashDisbursement(input) {
  return api.post('/financial/cash-disbursements', input);
}

export function voidCashDisbursement(id, reason) {
  return api.post(`/financial/cash-disbursements/${id}/void`, { reason });
}
