const express = require('express');
const controller = require('./inventory.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

router.get('/alerts', requirePermission('inventory.view'), controller.alerts);
router.get('/', requirePermission('inventory.view'), controller.list);
router.get('/:id', requirePermission('inventory.view'), controller.get);
router.post('/', requirePermission('inventory.adjust'), controller.create);
router.patch('/:id', requirePermission('inventory.adjust'), controller.update);
router.post('/:id/batches', requirePermission('inventory.adjust'), controller.receiveBatch);
router.post('/batches/:batchId/adjustments', requirePermission('inventory.adjust'), controller.adjustBatch);

module.exports = router;
