const express = require('express');
const controller = require('./animalBite.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// Viewing a record is gated the same as viewing a patient's full medical history
// (patients.history.view, §3.2) — the matrix has no separate "view animal bite record"
// row, and this record IS part of that patient's medical history.
router.get('/patients/:patientId/animal-bite-records', requirePermission('patients.history.view'), controller.listForPatient);
router.get('/animal-bite-records/:id', requirePermission('patients.history.view'), controller.get);

router.post('/animal-bite-records', requirePermission('animalbite.assessment.create'), controller.create);
router.patch('/animal-bite-records/:id/diagnosis', requirePermission('animalbite.diagnosis.record'), controller.recordDiagnosis);
router.post('/animal-bite-records/:id/complete', requirePermission('animalbite.diagnosis.record'), controller.complete);

router.post('/animal-bite-records/:id/doses', requirePermission('animalbite.treatment.administer'), controller.addDose);
router.patch('/animal-bite-records/:id/doses/:doseId/administer', requirePermission('animalbite.treatment.administer'), controller.administerDose);
router.post('/animal-bite-records/:id/rig', requirePermission('animalbite.treatment.administer'), controller.addRig);

router.post('/animal-bite-records/:id/education', requirePermission('education.record'), controller.addEducationLog);

// No dedicated permission code exists for follow-up scheduling in §3.2's matrix — it's
// treated here as part of "record treatment administration" for the same record, since in
// the §5.1 workflow the same Doctor/Nurse who just administered the dose is the one who
// schedules the next visit.
router.post('/animal-bite-records/:id/follow-ups', requirePermission('animalbite.treatment.administer'), controller.addFollowUp);
router.patch('/animal-bite-records/:id/follow-ups/:followUpId', requirePermission('animalbite.treatment.administer'), controller.updateFollowUpStatus);

module.exports = router;
