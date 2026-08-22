const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'on_leave', 'half_day'];

function canManage(actingUser) {
  return actingUser.permissions.includes('scheduling.manage');
}

/**
 * Restricts a query to the caller's own records unless they hold scheduling.manage.
 * `column` is qualified (e.g. 'staff_shifts.user_id') since callers join in `users` for the
 * display name, and unqualified WHERE clauses on a joined query are worth being explicit
 * about even where today's schema has no actual name collision.
 */
function scopeToSelfUnlessManager(query, actingUser, requestedUserId, column) {
  if (canManage(actingUser)) {
    if (requestedUserId) {
      query.andWhere(column, requestedUserId);
    }
    return query;
  }
  return query.andWhere(column, actingUser.id);
}

// --- Shifts ---------------------------------------------------------------

async function createShift({ userId, shiftDate, startTime, endTime, notes, createdBy, ipAddress }) {
  if (!userId || !shiftDate || !startTime || !endTime) {
    throw new ApiError(400, 'userId, shiftDate, startTime, and endTime are required.');
  }
  if (startTime >= endTime) {
    throw new ApiError(400, 'endTime must be after startTime (overnight shifts are not supported).');
  }

  const user = await db('users').where({ id: userId }).first();
  if (!user) {
    throw new ApiError(404, 'Staff user not found.');
  }

  const [created] = await db('staff_shifts')
    .insert({ user_id: userId, shift_date: shiftDate, start_time: startTime, end_time: endTime, notes: notes || null, created_by: createdBy })
    .returning(['id']);

  await auditLog.write({
    userId: createdBy,
    action: 'scheduling.shift_created',
    entityType: 'staff_shift',
    entityId: created.id,
    newValue: { userId, shiftDate, startTime, endTime },
    ipAddress,
  });

  return db('staff_shifts').where({ id: created.id }).first();
}

async function listShifts({ date, userId }, actingUser) {
  let query = db('staff_shifts')
    .join('users', 'users.id', 'staff_shifts.user_id')
    .select('staff_shifts.*', 'users.full_name as user_name')
    .orderBy('staff_shifts.shift_date')
    .orderBy('staff_shifts.start_time');

  query = scopeToSelfUnlessManager(query, actingUser, userId, 'staff_shifts.user_id');
  if (date) {
    query = query.andWhere('staff_shifts.shift_date', date);
  }
  return query;
}

async function deleteShift(id, { actingUserId, ipAddress }) {
  const shift = await db('staff_shifts').where({ id }).first();
  if (!shift) {
    throw new ApiError(404, 'Shift not found.');
  }
  await db('staff_shifts').where({ id }).del();

  await auditLog.write({
    userId: actingUserId,
    action: 'scheduling.shift_deleted',
    entityType: 'staff_shift',
    entityId: id,
    oldValue: { userId: shift.user_id, shiftDate: shift.shift_date },
    ipAddress,
  });
}

// --- Attendance -------------------------------------------------------------

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

async function clockIn(userId, ipAddress) {
  const today = todayDateString();
  const existing = await db('attendance_records').where({ user_id: userId, attendance_date: today }).first();
  if (existing && existing.clock_in_at) {
    throw new ApiError(400, 'Already clocked in today.');
  }

  if (existing) {
    await db('attendance_records').where({ id: existing.id }).update({ clock_in_at: db.fn.now(), updated_at: db.fn.now() });
  } else {
    await db('attendance_records').insert({ user_id: userId, attendance_date: today, clock_in_at: db.fn.now() });
  }

  await auditLog.write({ userId, action: 'scheduling.clock_in', entityType: 'attendance_record', entityId: userId, ipAddress });
  return db('attendance_records').where({ user_id: userId, attendance_date: today }).first();
}

async function clockOut(userId, ipAddress) {
  const today = todayDateString();
  const existing = await db('attendance_records').where({ user_id: userId, attendance_date: today }).first();
  if (!existing || !existing.clock_in_at) {
    throw new ApiError(400, 'Must clock in before clocking out.');
  }
  if (existing.clock_out_at) {
    throw new ApiError(400, 'Already clocked out today.');
  }

  await db('attendance_records').where({ id: existing.id }).update({ clock_out_at: db.fn.now(), updated_at: db.fn.now() });

  await auditLog.write({ userId, action: 'scheduling.clock_out', entityType: 'attendance_record', entityId: userId, ipAddress });
  return db('attendance_records').where({ user_id: userId, attendance_date: today }).first();
}

async function listAttendance({ date, userId }, actingUser) {
  let query = db('attendance_records')
    .join('users', 'users.id', 'attendance_records.user_id')
    .select('attendance_records.*', 'users.full_name as user_name')
    .orderBy('attendance_records.attendance_date', 'desc');

  query = scopeToSelfUnlessManager(query, actingUser, userId, 'attendance_records.user_id');
  if (date) {
    query = query.andWhere('attendance_records.attendance_date', date);
  }
  return query;
}

async function recordManualAttendance({ userId, attendanceDate, status, clockInAt, clockOutAt, notes, recordedBy, ipAddress }) {
  if (!userId || !attendanceDate) {
    throw new ApiError(400, 'userId and attendanceDate are required.');
  }
  if (status && !ATTENDANCE_STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${ATTENDANCE_STATUSES.join(', ')}`);
  }

  const existing = await db('attendance_records').where({ user_id: userId, attendance_date: attendanceDate }).first();
  const changes = {
    status: status || existing?.status || 'present',
    notes: notes !== undefined ? notes : existing?.notes,
    clock_in_at: clockInAt !== undefined ? clockInAt : existing?.clock_in_at,
    clock_out_at: clockOutAt !== undefined ? clockOutAt : existing?.clock_out_at,
    recorded_by: recordedBy,
    updated_at: db.fn.now(),
  };

  if (existing) {
    await db('attendance_records').where({ id: existing.id }).update(changes);
  } else {
    await db('attendance_records').insert({ user_id: userId, attendance_date: attendanceDate, ...changes });
  }

  await auditLog.write({
    userId: recordedBy,
    action: 'scheduling.attendance_recorded',
    entityType: 'attendance_record',
    entityId: userId,
    newValue: { attendanceDate, status: changes.status },
    ipAddress,
  });

  return db('attendance_records').where({ user_id: userId, attendance_date: attendanceDate }).first();
}

module.exports = {
  createShift,
  listShifts,
  deleteShift,
  clockIn,
  clockOut,
  listAttendance,
  recordManualAttendance,
};
