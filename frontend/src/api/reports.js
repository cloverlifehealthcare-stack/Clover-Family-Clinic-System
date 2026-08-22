import { api } from './client';

export function getDailyActivity(date) {
  return api.get(`/reports/daily-activity?date=${date}`);
}
