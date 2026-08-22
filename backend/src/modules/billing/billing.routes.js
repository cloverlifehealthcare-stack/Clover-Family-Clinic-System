const express = require('express');
const controller = require('./billing.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/patients/:patientId/billing-statements', requirePermission('billing.view'), controller.listForPatient);
router.get('/billing/statements/:id', requirePermission('billing.view'), controller.getStatement);

router.post('/billing/statements', requirePermission('billing.create'), controller.createStatement);
router.post('/billing/statements/:id/payments', requirePermission('payment.process'), controller.recordPayment);
router.post('/billing/statements/:id/void', requirePermission('payment.void'), controller.voidStatement);
router.post('/billing/payments/:paymentId/void', requirePermission('payment.void'), controller.voidPayment);

module.exports = router;
