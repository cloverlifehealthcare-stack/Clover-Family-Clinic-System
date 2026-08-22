const express = require('express');
const usersController = require('./users.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

// Registered before the blanket users.manage gate below, with its own lighter permission:
// appointments.manage (Admin has it, unlike users.manage) needs to know which doctors exist
// to build an appointment's doctor picker, without exposing the full staff roster or account
// details users.manage guards. See the comment on users.service.js's listActiveDoctors.
router.get('/doctors', requireAuth, requirePermission('appointments.manage'), usersController.listDoctors);

// Every other route: Management only, per docs/clover-architecture.md §3.2
// ("Manage user accounts" -> users.manage, Management-only by default).
router.use(requireAuth, requirePermission('users.manage'));

router.get('/', usersController.list);
router.get('/:id', usersController.get);
router.post('/', usersController.create);
router.post('/:id/deactivate', usersController.deactivate);
router.post('/:id/reactivate', usersController.reactivate);

module.exports = router;
