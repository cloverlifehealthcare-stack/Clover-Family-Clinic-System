const express = require('express');
const controller = require('./consultations.controller');
const { requireAuth } = require('../../middleware/auth.middleware');
const { requirePermission } = require('../../middleware/rbac.middleware');

const router = express.Router();

router.use(requireAuth);

// Same reasoning as animal-bite routes: viewing is gated by patients.history.view (no
// separate "view consultation" row exists in §3.2); follow-up scheduling is gated by
// education.record (the closest analogous "same staff finishing the visit" permission —
// here that's the step directly preceding follow-up in the §5.2 workflow).
router.get('/patients/:patientId/consultations', requirePermission('patients.history.view'), controller.listForPatient);
router.get('/consultations/:id', requirePermission('patients.history.view'), controller.get);

router.post('/consultations', requirePermission('consultation.assessment.create'), controller.create);
router.patch('/consultations/:id/diagnosis', requirePermission('consultation.diagnosis.record'), controller.recordDiagnosis);
router.post('/consultations/:id/complete', requirePermission('consultation.diagnosis.record'), controller.complete);
router.post('/consultations/:id/prescriptions', requirePermission('prescription.issue'), controller.issuePrescription);

router.post('/consultations/:id/education', requirePermission('education.record'), controller.addEducationLog);
router.post('/consultations/:id/follow-ups', requirePermission('education.record'), controller.addFollowUp);
router.patch('/consultations/:id/follow-ups/:followUpId', requirePermission('education.record'), controller.updateFollowUpStatus);

module.exports = router;
