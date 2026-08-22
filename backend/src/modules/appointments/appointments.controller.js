const appointmentsService = require('./appointments.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_CREATE_FIELDS = ['patientId', 'doctorId', 'serviceType', 'scheduledDate', 'scheduledTime'];

const create = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const appointment = await appointmentsService.createAppointment({
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(appointment);
});

const get = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.getAppointment(req.params.id, {
    roleName: req.user.roleName,
    id: req.user.id,
  });
  res.json(appointment);
});

const list = asyncHandler(async (req, res) => {
  const appointments = await appointmentsService.listAppointments(
    { date: req.query.date, doctorId: req.query.doctorId, patientId: req.query.patientId, status: req.query.status },
    { roleName: req.user.roleName, id: req.user.id }
  );
  res.json(appointments);
});

const update = asyncHandler(async (req, res) => {
  const appointment = await appointmentsService.updateAppointment(req.params.id, req.body, {
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(appointment);
});

function statusHandler(newStatus) {
  return asyncHandler(async (req, res) => {
    const appointment = await appointmentsService.setStatus(req.params.id, newStatus, {
      actingUserId: req.user.id,
      ipAddress: req.ip,
    });
    res.json(appointment);
  });
}

module.exports = {
  create,
  get,
  list,
  update,
  checkIn: statusHandler('checked_in'),
  complete: statusHandler('completed'),
  cancel: statusHandler('cancelled'),
  markNoShow: statusHandler('no_show'),
};
