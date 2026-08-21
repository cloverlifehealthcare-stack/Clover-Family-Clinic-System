const express = require('express');
const usersController = require('./users.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

// Every route: Management only, per docs/clover-architecture.md §3.2
// ("Manage user accounts" -> users.manage, Management-only by default).
router.use(requireAuth, requirePermission('users.manage'));

router.get('/', usersController.list);
router.get('/:id', usersController.get);
router.post('/', usersController.create);
router.post('/:id/deactivate', usersController.deactivate);
router.post('/:id/reactivate', usersController.reactivate);

module.exports = router;
