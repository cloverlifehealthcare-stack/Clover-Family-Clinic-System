import { api } from './client';

export function getDailyActivity(date) {
  return api.get(`/reports/daily-activity?date=${date}`);
}

export function getClinicalTrends({ startDate, endDate, groupBy }) {
  const params = new URLSearchParams({ startDate, endDate, groupBy });
  return api.get(`/reports/trends?${params.toString()}`);
}
