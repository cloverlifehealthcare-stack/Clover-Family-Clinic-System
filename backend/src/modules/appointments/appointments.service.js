const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const VALID_SERVICE_TYPES = ['animal_bite', 'consultation', 'follow_up_vaccine'];
const SLOT_MINUTES = 15; // fixed for all appointment types, per docs/clover-architecture.md §0

const ALLOWED_TRANSITIONS = {
  scheduled: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed', 'no_show'],
  completed: [],
  cancelled: [],
  no_show: [],
};

// Postgres unique_violation on the appointments_doctor_slot_unique partial index (see migration).
const UNIQUE_VIOLATION = '23505';

// Every other module (patients, animal bite, consultations) returns human-readable joined
// data, not bare foreign keys — appointments should too, rather than making the frontend do
// an N+1 fetch per row to show a patient/doctor name in a list.
function withNames(query) {
  return query
    .join('patients', 'patients.id', 'appointments.patient_id')
    .join('users as doctor_user', 'doctor_user.id', 'appointments.doctor_id')
    .select(
      'appointments.*',
      'patients.patient_code',
      'patients.first_name as patient_first_name',
      'patients.last_name as patient_last_name',
      'doctor_user.full_name as doctor_name'
    );
}

function assertOnSlotBoundary(scheduledTime) {
  const minutes = Number(scheduledTime.split(':')[1]);
  if (Number.isNaN(minutes) || minutes % SLOT_MINUTES !== 0) {
    throw new ApiError(400, `scheduledTime must fall on a ${SLOT_MINUTES}-minute boundary (e.g. 09:00, 09:15, 09:30).`);
  }
}

async function assertIsDoctor(doctorId) {
  const doctor = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'users.id': doctorId })
    .select('users.is_active', 'roles.name as role_name')
    .first();

  if (!doctor || doctor.role_name !== 'Doctor') {
    throw new ApiError(400, 'doctorId must reference an active user with the Doctor role.');
  }
  if (!doctor.is_active) {
    throw new ApiError(400, 'This doctor account is deactivated.');
  }
}

function scopeToOwnScheduleIfDoctor(query, actingUser) {
  if (actingUser.roleName === 'Doctor') {
    return query.andWhere('appointments.doctor_id', actingUser.id);
  }
  return query;
}

async function createAppointment(input) {
  const { patientId, doctorId, serviceType, scheduledDate, scheduledTime, notes, createdBy, ipAddress } = input;

  if (!VALID_SERVICE_TYPES.includes(serviceType)) {
    throw new ApiError(400, `serviceType must be one of: ${VALID_SERVICE_TYPES.join(', ')}`);
  }
  assertOnSlotBoundary(scheduledTime);
  await assertIsDoctor(doctorId);

  const patient = await db('patients').where({ id: patientId }).first();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  let created;
  try {
    [created] = await db('appointments')
      .insert({
        patient_id: patientId,
        doctor_id: doctorId,
        service_type: serviceType,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        slot_minutes: SLOT_MINUTES,
        notes: notes || null,
        created_by: createdBy,
      })
      .returning(['id']);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new ApiError(409, 'This doctor already has an appointment at that date and time.');
    }
    throw err;
  }

  await auditLog.write({
    userId: createdBy,
    action: 'appointment.create',
    entityType: 'appointment',
    entityId: created.id,
    newValue: { patientId, doctorId, serviceType, scheduledDate, scheduledTime },
    ipAddress,
  });

  return withNames(db('appointments').where({ 'appointments.id': created.id })).first();
}

async function getAppointment(id, actingUser) {
  let query = withNames(db('appointments').where({ 'appointments.id': id }));
  query = scopeToOwnScheduleIfDoctor(query, actingUser);
  const appointment = await query.first();

  if (!appointment) {
    throw new ApiError(404, 'Appointment not found.');
  }
  return appointment;
}

async function listAppointments(filters, actingUser) {
  let query = withNames(db('appointments')).orderBy('appointments.scheduled_date').orderBy('appointments.scheduled_time');
  query = scopeToOwnScheduleIfDoctor(query, actingUser);

  if (filters.date) {
    query = query.andWhere('appointments.scheduled_date', filters.date);
  }
  if (filters.doctorId && actingUser.roleName !== 'Doctor') {
    query = query.andWhere('appointments.doctor_id', filters.doctorId);
  }
  if (filters.patientId) {
    query = query.andWhere('appointments.patient_id', filters.patientId);
  }
  if (filters.status) {
    query = query.andWhere('appointments.status', filters.status);
  }

  return query;
}

async function updateAppointment(id, updates, { actingUserId, ipAddress }) {
  const before = await db('appointments').where({ id }).first();
  if (!before) {
    throw new ApiError(404, 'Appointment not found.');
  }
  if (before.status !== 'scheduled') {
    throw new ApiError(400, `Cannot reschedule an appointment that is already ${before.status}.`);
  }

  const changes = {};
  if (updates.doctorId) {
    await assertIsDoctor(updates.doctorId);
    changes.doctor_id = updates.doctorId;
  }
  if (updates.serviceType) {
    if (!VALID_SERVICE_TYPES.includes(updates.serviceType)) {
      throw new ApiError(400, `serviceType must be one of: ${VALID_SERVICE_TYPES.join(', ')}`);
    }
    changes.service_type = updates.serviceType;
  }
  if (updates.scheduledDate) {
    changes.scheduled_date = updates.scheduledDate;
  }
  if (updates.scheduledTime) {
    assertOnSlotBoundary(updates.scheduledTime);
    changes.scheduled_time = updates.scheduledTime;
  }
  if (updates.notes !== undefined) {
    changes.notes = updates.notes;
  }

  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'No editable fields provided.');
  }

  try {
    await db('appointments').where({ id }).update(changes);
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) {
      throw new ApiError(409, 'This doctor already has an appointment at that date and time.');
    }
    throw err;
  }

  await auditLog.write({
    userId: actingUserId,
    action: 'appointment.reschedule',
    entityType: 'appointment',
    entityId: id,
    oldValue: { scheduledDate: before.scheduled_date, scheduledTime: before.scheduled_time, doctorId: before.doctor_id },
    newValue: changes,
    ipAddress,
  });

  return withNames(db('appointments').where({ 'appointments.id': id })).first();
}

async function setStatus(id, newStatus, { actingUserId, ipAddress }) {
  const appointment = await db('appointments').where({ id }).first();
  if (!appointment) {
    throw new ApiError(404, 'Appointment not found.');
  }

  const allowed = ALLOWED_TRANSITIONS[appointment.status] || [];
  if (!allowed.includes(newStatus)) {
    throw new ApiError(400, `Cannot move an appointment from "${appointment.status}" to "${newStatus}".`);
  }

  await db('appointments').where({ id }).update({ status: newStatus });

  await auditLog.write({
    userId: actingUserId,
    action: 'appointment.status_change',
    entityType: 'appointment',
    entityId: id,
    oldValue: { status: appointment.status },
    newValue: { status: newStatus },
    ipAddress,
  });

  return withNames(db('appointments').where({ 'appointments.id': id })).first();
}

module.exports = { createAppointment, getAppointment, listAppointments, updateAppointment, setStatus };
