const billingService = require('./billing.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_CREATE_FIELDS = ['patientId', 'sourceType', 'items'];

const createStatement = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CREATE_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const statement = await billingService.createStatement({
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(statement);
});

const getStatement = asyncHandler(async (req, res) => {
  res.json(await billingService.getStatement(req.params.id));
});

const listForPatient = asyncHandler(async (req, res) => {
  res.json(await billingService.listStatementsForPatient(req.params.patientId));
});

const recordPayment = asyncHandler(async (req, res) => {
  const statement = await billingService.recordPayment(req.params.id, {
    ...req.body,
    receivedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(statement);
});

const voidStatement = asyncHandler(async (req, res) => {
  const statement = await billingService.voidStatement(req.params.id, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(statement);
});

const voidPayment = asyncHandler(async (req, res) => {
  const statement = await billingService.voidPayment(req.params.paymentId, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(statement);
});

module.exports = { createStatement, getStatement, listForPatient, recordPayment, voidStatement, voidPayment };
