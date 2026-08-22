const express = require('express');
const controller = require('./reminders.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('reminders.view'), controller.list);
router.post('/run', requirePermission('reminders.manage'), controller.run);

module.exports = router;
