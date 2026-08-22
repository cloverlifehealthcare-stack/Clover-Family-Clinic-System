const express = require('express');
const controller = require('./financial.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/expenses', requirePermission('financial.view'), controller.listExpenses);
router.post('/expenses', requirePermission('financial.manage'), controller.createExpense);
router.post('/expenses/:id/void', requirePermission('financial.manage'), controller.voidExpense);

router.get('/sales-journal', requirePermission('financial.view'), controller.getSalesJournal);
router.get('/sales-ledger', requirePermission('financial.view'), controller.getSalesLedger);
router.get('/summary', requirePermission('financial.view'), controller.getSummary);

module.exports = router;
