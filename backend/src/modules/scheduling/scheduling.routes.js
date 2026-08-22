const express = require('express');
const controller = require('./scheduling.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// Self-service — clocking in/out only ever touches the caller's own record, so this is
// gated by authentication alone, not a permission, the same reasoning as the doc's row-level
// scoping elsewhere: this isn't "view/manage everyone's attendance," it's "record my own."
router.post('/attendance/clock-in', controller.clockIn);
router.post('/attendance/clock-out', controller.clockOut);

router.get('/shifts', requirePermission('scheduling.view'), controller.listShifts);
router.post('/shifts', requirePermission('scheduling.manage'), controller.createShift);
router.delete('/shifts/:id', requirePermission('scheduling.manage'), controller.deleteShift);

router.get('/attendance', requirePermission('scheduling.view'), controller.listAttendance);
router.post('/attendance', requirePermission('scheduling.manage'), controller.recordManualAttendance);

module.exports = router;
