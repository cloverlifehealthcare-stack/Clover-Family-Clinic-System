const express = require('express');
const controller = require('./reports.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/daily-activity', requirePermission('reports.view'), controller.getDailyActivity);
router.get('/trends', requirePermission('reports.view'), controller.getClinicalTrends);

module.exports = router;
