const express = require('express');
const authController = require('./auth.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { loginRateLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/login', loginRateLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);

module.exports = router;
