const express = require('express');
const controller = require('./appointments.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// View: everyone with appointments.view (Management/Admin/Doctor/Nurse/Cashier per §3.2) —
// a Doctor is row-scoped to their own schedule inside the service layer, per "👁 own schedule".
router.get('/', requirePermission('appointments.view'), controller.list);
router.get('/:id', requirePermission('appointments.view'), controller.get);

// Write: Management and Admin only per §3.2 ("Create / view appointments" — Doctor/Nurse/
// Cashier all show 👁, not ✅).
router.post('/', requirePermission('appointments.manage'), controller.create);
router.patch('/:id', requirePermission('appointments.manage'), controller.update);
router.post('/:id/check-in', requirePermission('appointments.manage'), controller.checkIn);
router.post('/:id/complete', requirePermission('appointments.manage'), controller.complete);
router.post('/:id/cancel', requirePermission('appointments.manage'), controller.cancel);
router.post('/:id/no-show', requirePermission('appointments.manage'), controller.markNoShow);

module.exports = router;
