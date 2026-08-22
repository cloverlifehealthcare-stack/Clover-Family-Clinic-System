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

const getSalesJournal = asyncHandler(async (req, res) => {
  res.json(await financialService.getSalesJournal(req.query));
});

const getSalesLedger = asyncHandler(async (req, res) => {
  res.json(await financialService.getSalesLedger(req.query));
});

const getSummary = asyncHandler(async (req, res) => {
  res.json(await financialService.getSummary(req.query));
});

module.exports = { createExpense, voidExpense, listExpenses, getSalesJournal, getSalesLedger, getSummary };
