const express = require('express');
const controller = require('./patientAuth.controller');
const { requirePatientAuth } = require('../../middleware/patientAuth.middleware');
const { patientLoginRateLimiter, patientRegisterRateLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

router.post('/register', patientRegisterRateLimiter, controller.register);
router.post('/login', patientLoginRateLimiter, controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', requirePatientAuth, controller.logout);
router.get('/me', requirePatientAuth, controller.me);
router.patch('/me', requirePatientAuth, controller.updateMe);

module.exports = router;
