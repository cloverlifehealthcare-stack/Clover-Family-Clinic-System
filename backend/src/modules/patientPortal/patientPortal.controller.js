const patientPortalService = require('./patientPortal.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_BOOKING_FIELDS = ['doctorId', 'serviceType', 'scheduledDate', 'scheduledTime'];

const listDoctors = asyncHandler(async (req, res) => {
  res.json(await patientPortalService.listDoctors());
});

const listMyAppointments = asyncHandler(async (req, res) => {
  res.json(await patientPortalService.listMyAppointments(req.patientAccount.patientId));
});

const bookAppointment = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_BOOKING_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const appointment = await patientPortalService.bookAppointment(req.patientAccount.patientId, { ...req.body, ipAddress: req.ip });
  res.status(201).json(appointment);
});

const cancelMyAppointment = asyncHandler(async (req, res) => {
  const appointment = await patientPortalService.cancelMyAppointment(req.patientAccount.patientId, req.params.id, req.ip);
  res.json(appointment);
});

module.exports = { listDoctors, listMyAppointments, bookAppointment, cancelMyAppointment };
