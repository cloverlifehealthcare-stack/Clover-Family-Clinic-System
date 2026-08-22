const schedulingService = require('./scheduling.service');
const permissionService = require('../../services/permission.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * listShifts/listAttendance need to know whether the caller holds scheduling.manage to decide
 * row-scoping (own records vs. everyone's) — a second permission check beyond the route-level
 * requirePermission('scheduling.view') gate, since scheduling.view alone doesn't say which.
 */
async function buildActingUser(req) {
  const permissions = await permissionService.getEffectivePermissions(req.user.id);
  return { id: req.user.id, permissions };
}

const createShift = asyncHandler(async (req, res) => {
  const shift = await schedulingService.createShift({
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(shift);
});

const listShifts = asyncHandler(async (req, res) => {
  const actingUser = await buildActingUser(req);
  res.json(await schedulingService.listShifts({ date: req.query.date, userId: req.query.userId }, actingUser));
});

const deleteShift = asyncHandler(async (req, res) => {
  await schedulingService.deleteShift(req.params.id, { actingUserId: req.user.id, ipAddress: req.ip });
  res.status(204).send();
});

const clockIn = asyncHandler(async (req, res) => {
  res.status(201).json(await schedulingService.clockIn(req.user.id, req.ip));
});

const clockOut = asyncHandler(async (req, res) => {
  res.json(await schedulingService.clockOut(req.user.id, req.ip));
});

const listAttendance = asyncHandler(async (req, res) => {
  const actingUser = await buildActingUser(req);
  res.json(await schedulingService.listAttendance({ date: req.query.date, userId: req.query.userId }, actingUser));
});

const recordManualAttendance = asyncHandler(async (req, res) => {
  const record = await schedulingService.recordManualAttendance({
    ...req.body,
    recordedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

module.exports = { createShift, listShifts, deleteShift, clockIn, clockOut, listAttendance, recordManualAttendance };
