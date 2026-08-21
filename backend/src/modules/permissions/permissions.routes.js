const express = require('express');
const permissionsController = require('./permissions.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth, requirePermission('users.manage'));

router.get('/roles', permissionsController.listRoles);
router.get('/', permissionsController.listPermissions);
router.get('/users/:userId', permissionsController.getUserPermissions);
router.put('/users/:userId', permissionsController.setOverride);

module.exports = router;
