const express = require('express');
const controller = require('./audit.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('audit.view'), controller.list);
router.get('/entity-types', requirePermission('audit.view'), controller.listEntityTypes);
router.get('/export', requirePermission('audit.view'), controller.exportCsv);

module.exports = router;
