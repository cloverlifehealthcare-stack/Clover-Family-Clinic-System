const express = require('express');
const controller = require('./services.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// No dedicated "manage services catalog" permission exists in §3.2 — the matrix's
// billing.create row ("create billing statement / charges") is the closest fit, since this
// catalog exists only to price billing_items. Gated the same way, including Cashier, since
// nothing in the business rules singles out catalog pricing as management-only the way
// financial reports are.
router.get('/', requirePermission('billing.view'), controller.list);
router.post('/', requirePermission('billing.create'), controller.create);
router.patch('/:id', requirePermission('billing.create'), controller.update);

module.exports = router;
