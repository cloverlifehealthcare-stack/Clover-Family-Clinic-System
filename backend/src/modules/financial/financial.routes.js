const express = require('express');
const controller = require('./financial.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/expenses', requirePermission('financial.view'), controller.listExpenses);
router.post('/expenses', requirePermission('financial.manage'), controller.createExpense);
router.post('/expenses/:id/void', requirePermission('financial.manage'), controller.voidExpense);

router.get('/cash-disbursements', requirePermission('financial.view'), controller.listCashDisbursements);
router.post('/cash-disbursements', requirePermission('financial.manage'), controller.createCashDisbursement);
router.post('/cash-disbursements/:id/void', requirePermission('financial.manage'), controller.voidCashDisbursement);

router.get('/sales-journal', requirePermission('financial.view'), controller.getSalesJournal);
router.get('/purchases', requirePermission('financial.view'), controller.getPurchases);
router.get('/summary', requirePermission('financial.view'), controller.getSummary);

router.get('/vaccine-costs', requirePermission('financial.view'), controller.listVaccineCosts);
router.put('/vaccine-costs/:itemId', requirePermission('financial.manage'), controller.updateVaccineCost);

module.exports = router;
