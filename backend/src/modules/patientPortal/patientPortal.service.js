const usersService = require('../users/users.service');
const appointmentsService = require('../appointments/appointments.service');
const ApiError = require('../../utils/ApiError');

// Thin wrappers around the existing staff-facing appointments/users services, not a
// reimplementation — same slot validation, same double-booking prevention, same appointment
// state machine. The only new behavior here is forcing every call to the caller's own
// patientId, exactly the way animalBite/consultations force "own patients" scoping server-side
// rather than trusting a client-supplied ID.

function listDoctors() {
  return usersService.listActiveDoctors();
}

function listMyAppointments(patientId) {
  // {} in place of an actingUser is safe: listAppointments only special-cases
  // actingUser.roleName === 'Doctor', which a patient token never satisfies.
  return appointmentsService.listAppointments({ patientId }, {});
}

function bookAppointment(patientId, { doctorId, serviceType, scheduledDate, scheduledTime, notes, ipAddress }) {
  return appointmentsService.createAppointment({
    patientId,
    doctorId,
    serviceType,
    scheduledDate,
    scheduledTime,
    notes,
    createdBy: null, // patient-initiated — see migration comment on appointments.created_by
    ipAddress,
  });
}

async function cancelMyAppointment(patientId, appointmentId, ipAddress) {
  const appointment = await appointmentsService.getAppointment(appointmentId, {});
  if (appointment.patient_id !== patientId) {
    // 404, not 403 — don't confirm to a probing caller that an appointment ID belongs to
    // someone else.
    throw new ApiError(404, 'Appointment not found.');
  }
  return appointmentsService.setStatus(appointmentId, 'cancelled', { actingUserId: null, ipAddress });
}

module.exports = { listDoctors, listMyAppointments, bookAppointment, cancelMyAppointment };
