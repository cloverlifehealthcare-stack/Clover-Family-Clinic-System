const animalBiteService = require('./animalBite.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_CREATE_FIELDS = ['patientId', 'visitDate', 'dateOfExposure', 'animalType', 'biteLocation', 'woundDescription', 'vitalSigns'];

const create = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const record = await animalBiteService.createRecord({
    ...req.body,
    assessedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

const get = asyncHandler(async (req, res) => {
  res.json(await animalBiteService.getRecord(req.params.id));
});

const listForPatient = asyncHandler(async (req, res) => {
  res.json(await animalBiteService.listRecordsForPatient(req.params.patientId));
});

const recordDiagnosis = asyncHandler(async (req, res) => {
  const record = await animalBiteService.recordDiagnosis(req.params.id, {
    ...req.body,
    doctorId: req.user.id,
    actingUserRole: req.user.roleName,
    ipAddress: req.ip,
  });
  res.json(record);
});

const addDose = asyncHandler(async (req, res) => {
  const record = await animalBiteService.addDose(req.params.id, {
    ...req.body,
    administeredBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

const administerDose = asyncHandler(async (req, res) => {
  const record = await animalBiteService.administerDose(req.params.id, req.params.doseId, {
    ...req.body,
    administeredBy: req.user.id,
    ipAddress: req.ip,
  });
  res.json(record);
});

const addRig = asyncHandler(async (req, res) => {
  const record = await animalBiteService.addRig(req.params.id, {
    ...req.body,
    administeredBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

const complete = asyncHandler(async (req, res) => {
  const record = await animalBiteService.completeRecord(req.params.id, {
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(record);
});

const addEducationLog = asyncHandler(async (req, res) => {
  const record = await animalBiteService.addEducationLog(req.params.id, {
    ...req.body,
    givenBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

const addFollowUp = asyncHandler(async (req, res) => {
  const record = await animalBiteService.addFollowUp(req.params.id, {
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(record);
});

const updateFollowUpStatus = asyncHandler(async (req, res) => {
  const record = await animalBiteService.updateFollowUpStatus(req.params.id, req.params.followUpId, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(record);
});

module.exports = {
  create, get, listForPatient, recordDiagnosis, addDose, administerDose, addRig,
  complete, addEducationLog, addFollowUp, updateFollowUpStatus,
};
