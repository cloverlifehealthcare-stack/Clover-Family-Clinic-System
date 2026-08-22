const express = require('express');
const controller = require('./patientPortal.controller');
const { requirePatientAuth } = require('../../middleware/patientAuth.middleware');

const router = express.Router();

router.use(requirePatientAuth);

router.get('/doctors', controller.listDoctors);
router.get('/appointments', controller.listMyAppointments);
router.post('/appointments', controller.bookAppointment);
router.post('/appointments/:id/cancel', controller.cancelMyAppointment);

module.exports = router;
