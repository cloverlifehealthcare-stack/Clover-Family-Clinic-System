const express = require('express');
const controller = require('./reminders.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');
const { requireCronSecret } = require('../../middleware/cronAuth.middleware');

const router = express.Router();

// Registered before requireAuth below — Vercel Cron has no staff login to present, so this
// route is gated by requireCronSecret instead, not the staff permission system.
router.get('/cron', requireCronSecret, controller.runCron);

router.use(requireAuth);

router.get('/', requirePermission('reminders.view'), controller.list);
router.post('/run', requirePermission('reminders.manage'), controller.run);

module.exports = router;
