const express = require('express');
const controller = require('./dashboard.controller');
const { requireAuth } = require('../../middleware/auth.middleware');

const router = express.Router();

// Deliberately no requirePermission here — every logged-in user can load the dashboard shell;
// the controller/service decide what content to include per-section based on the caller's
// existing permissions for that section's own module. See dashboard.service.js's doc comment.
router.use(requireAuth);

router.get('/', controller.getDashboard);

module.exports = router;
