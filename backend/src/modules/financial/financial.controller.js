const financialService = require('./financial.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_EXPENSE_FIELDS = ['expenseDate', 'category', 'description', 'amount'];

const createExpense = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_EXPENSE_FIELDS) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const expense = await financialService.createExpense({
    ...req.body,
    recordedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(expense);
});

const voidExpense = asyncHandler(async (req, res) => {
  const expense = await financialService.voidExpense(req.params.id, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(expense);
});

const listExpenses = asyncHandler(async (req, res) => {
  res.json(await financialService.listExpenses(req.query));
});

const REQUIRED_CASH_DISBURSEMENT_FIELDS = ['disbursementDate', 'particulars', 'amount', 'givenTo'];

const createCashDisbursement = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CASH_DISBURSEMENT_FIELDS) {
    if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  const disbursement = await financialService.createCashDisbursement({
    ...req.body,
    recordedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(disbursement);
});

const voidCashDisbursement = asyncHandler(async (req, res) => {
  const disbursement = await financialService.voidCashDisbursement(req.params.id, {
    ...req.body,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(disbursement);
});

const listCashDisbursements = asyncHandler(async (req, res) => {
  res.json(await financialService.listCashDisbursements(req.query));
});

const getSalesJournal = asyncHandler(async (req, res) => {
  res.json(await financialService.getSalesJournal(req.query));
});

const getPurchases = asyncHandler(async (req, res) => {
  res.json(await financialService.getPurchases(req.query));
});

const getSummary = asyncHandler(async (req, res) => {
  res.json(await financialService.getSummary(req.query));
});

const listServiceFees = asyncHandler(async (req, res) => {
  res.json(await financialService.listServiceFees());
});

const updateServiceFee = asyncHandler(async (req, res) => {
  if (req.body.doctorFee === undefined || req.body.doctorFee === null || req.body.doctorFee === '') {
    throw new ApiError(400, 'doctorFee is required.');
  }
  const fee = await financialService.updateServiceFee(req.params.sourceType, {
    doctorFee: req.body.doctorFee,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(fee);
});

module.exports = {
  createExpense,
  voidExpense,
  listExpenses,
  createCashDisbursement,
  voidCashDisbursement,
  listCashDisbursements,
  getSalesJournal,
  getPurchases,
  getSummary,
  listServiceFees,
  updateServiceFee,
};
