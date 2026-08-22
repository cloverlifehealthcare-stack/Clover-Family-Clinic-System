const express = require('express');
const patientsController = require('./patients.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// Field-level restriction (Cashier gets billing-relevant fields only, per §3.2) is applied
// inside the controller based on patients.history.view, not by a separate route/permission.
router.get('/', requirePermission('patients.view'), patientsController.list);
router.get('/:id', requirePermission('patients.view'), patientsController.get);
router.post('/', requirePermission('patients.create'), patientsController.create);
router.patch('/:id', requirePermission('patients.edit'), patientsController.update);

module.exports = router;
