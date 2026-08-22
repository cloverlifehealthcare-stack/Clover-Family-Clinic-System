import { api } from './client';

export function listShifts(date) {
  return api.get(`/scheduling/shifts?date=${date}`);
}

export function createShift(payload) {
  return api.post('/scheduling/shifts', payload);
}

export function deleteShift(id) {
  return api.delete(`/scheduling/shifts/${id}`);
}

export function clockIn() {
  return api.post('/scheduling/attendance/clock-in', {});
}

export function clockOut() {
  return api.post('/scheduling/attendance/clock-out', {});
}

export function listAttendance(date) {
  return api.get(`/scheduling/attendance?date=${date}`);
}

export function recordAttendance(payload) {
  return api.post('/scheduling/attendance', payload);
}

export function listStaff() {
  return api.get('/users/staff');
}
