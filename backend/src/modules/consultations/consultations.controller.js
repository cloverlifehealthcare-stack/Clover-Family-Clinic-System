const consultationsService = require('./consultations.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_CREATE_FIELDS = ['patientId', 'visitDate', 'chiefComplaint', 'vitalSigns'];

const create = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const consultation = await consultationsService.createConsultation({
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(consultation);
});

const get = asyncHandler(async (req, res) => {
  res.json(await consultationsService.getConsultation(req.params.id));
});

const listForPatient = asyncHandler(async (req, res) => {
  res.json(await consultationsService.listConsultationsForPatient(req.params.patientId));
});

const recordDiagnosis = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.recordDiagnosis(req.params.id, {
    ...req.body,
    doctorId: req.user.id,
    actingUserRole: req.user.roleName,
    ipAddress: req.ip,
  });
  res.json(consultation);
});

const complete = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.completeConsultation(req.params.id, {
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(consultation);
});

const issuePrescription = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.issuePrescription(req.params.id, {
    ...req.body,
    doctorId: req.user.id,
    actingUserRole: req.user.roleName,
    ipAddress: req.ip,
  });
  res.status(201).json(consultation);
});

const addEducationLog = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.addEducationLog(req.params.id, {
    ...req.body,
    givenBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(consultation);
});

const addFollowUp = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.addFollowUp(req.params.id, {
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(consultation);
});

const updateFollowUpStatus = asyncHandler(async (req, res) => {
  const consultation = await consultationsService.updateFollowUpStatus(req.params.id, req.params.followUpId, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(consultation);
});

module.exports = {
  create, get, listForPatient, recordDiagnosis, complete, issuePrescription,
  addEducationLog, addFollowUp, updateFollowUpStatus,
};
