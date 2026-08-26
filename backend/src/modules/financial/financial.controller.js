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

const REQUIRED_CASH_DISBURSEMENT_FIELDS = ['disbursementDate', 'category', 'particulars', 'amount', 'givenTo'];

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

const listVaccineCosts = asyncHandler(async (req, res) => {
  res.json(await financialService.listVaccineCosts());
});

const updateVaccineCost = asyncHandler(async (req, res) => {
  if (req.body.currentCost === undefined || req.body.currentCost === null || req.body.currentCost === '') {
    throw new ApiError(400, 'currentCost is required.');
  }
  const item = await financialService.updateVaccineCost(req.params.itemId, {
    currentCost: req.body.currentCost,
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(item);
});

function sendCsv(res, csv, filename) {
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
}

const exportSalesJournalCsv = asyncHandler(async (req, res) => {
  sendCsv(res, await financialService.exportSalesJournalCsv(req.query), 'sales-journal-export.csv');
});

const exportPurchasesCsv = asyncHandler(async (req, res) => {
  sendCsv(res, await financialService.exportPurchasesCsv(req.query), 'purchases-export.csv');
});

const exportExpensesCsv = asyncHandler(async (req, res) => {
  sendCsv(res, await financialService.exportExpensesCsv(req.query), 'expenses-export.csv');
});

const exportCashDisbursementsCsv = asyncHandler(async (req, res) => {
  sendCsv(res, await financialService.exportCashDisbursementsCsv(req.query), 'cash-disbursements-export.csv');
});

const exportFullReportCsv = asyncHandler(async (req, res) => {
  sendCsv(res, await financialService.exportFullReportCsv(req.query), 'financial-full-report.csv');
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
  listVaccineCosts,
  updateVaccineCost,
  exportSalesJournalCsv,
  exportPurchasesCsv,
  exportExpensesCsv,
  exportCashDisbursementsCsv,
  exportFullReportCsv,
};
