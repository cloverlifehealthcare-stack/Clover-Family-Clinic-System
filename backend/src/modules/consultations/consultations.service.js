const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

async function getConsultation(id) {
  const consultation = await db('consultations').where({ id }).first();
  if (!consultation) {
    throw new ApiError(404, 'Consultation not found.');
  }

  const [prescriptions, education, followUps] = await Promise.all([
    db('prescriptions').where({ consultation_id: id }).orderBy('date_issued', 'desc'),
    db('patient_education_logs').where({ source_type: 'consultation', source_id: id }).orderBy('given_at', 'desc'),
    db('follow_ups').where({ source_type: 'consultation', source_id: id }).orderBy('scheduled_date'),
  ]);

  const prescriptionsWithItems = await Promise.all(
    prescriptions.map(async (prescription) => ({
      ...prescription,
      items: await db('prescription_items').where({ prescription_id: prescription.id }),
    }))
  );

  return { ...consultation, prescriptions: prescriptionsWithItems, educationLogs: education, followUps };
}

async function listConsultationsForPatient(patientId) {
  return db('consultations').where({ patient_id: patientId }).orderBy('visit_date', 'desc');
}

async function createConsultation(input) {
  const { patientId, visitDate, chiefComplaint, vitalSigns, assessmentNotes, createdBy, ipAddress } = input;

  const patient = await db('patients').where({ id: patientId }).first();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  const [created] = await db('consultations')
    .insert({
      patient_id: patientId,
      visit_date: visitDate,
      chief_complaint: chiefComplaint,
      vital_signs: JSON.stringify(vitalSigns),
      assessment_notes: assessmentNotes || null,
      created_by: createdBy,
      status: 'assessed',
    })
    .returning(['id']);

  await auditLog.write({
    userId: createdBy,
    action: 'consultation.create',
    entityType: 'consultation',
    entityId: created.id,
    newValue: { patientId, chiefComplaint },
    ipAddress,
  });

  return getConsultation(created.id);
}

async function recordDiagnosis(id, { diagnosis, treatmentNotes, remarks, followUpDate, doctorId, actingUserRole, ipAddress }) {
  const before = await getConsultation(id);

  // Same "own patients" rule as animal_bite_records.recordDiagnosis — see that file's comment.
  if (actingUserRole === 'Doctor' && before.doctor_id !== null && before.doctor_id !== doctorId) {
    throw new ApiError(403, 'Only the doctor who diagnosed this consultation may revise it.');
  }

  if (!diagnosis) {
    throw new ApiError(400, 'diagnosis is required.');
  }

  await db('consultations')
    .where({ id })
    .update({
      diagnosis,
      treatment_notes: treatmentNotes || null,
      remarks: remarks || null,
      follow_up_date: followUpDate || null,
      doctor_id: doctorId,
      status: 'diagnosed',
    });

  await auditLog.write({
    userId: doctorId,
    action: 'consultation.diagnosis_recorded',
    entityType: 'consultation',
    entityId: id,
    oldValue: { diagnosis: before.diagnosis },
    newValue: { diagnosis },
    ipAddress,
  });

  return getConsultation(id);
}

async function completeConsultation(id, { actingUserId, ipAddress }) {
  await getConsultation(id); // 404s if missing
  await db('consultations').where({ id }).update({ status: 'completed' });

  await auditLog.write({
    userId: actingUserId,
    action: 'consultation.completed',
    entityType: 'consultation',
    entityId: id,
    ipAddress,
  });

  return getConsultation(id);
}

async function issuePrescription(id, input) {
  const { diagnosisSummary, remarks, followUpDate, followUpInstructions, items, doctorId, actingUserRole, ipAddress } = input;

  const consultation = await getConsultation(id);

  if (!consultation.doctor_id) {
    throw new ApiError(400, "A doctor's diagnosis must be recorded before a prescription can be issued.");
  }
  // "Doctor ✅ own patients" (§3.2) — only the diagnosing doctor (or Management) may issue.
  if (actingUserRole === 'Doctor' && consultation.doctor_id !== doctorId) {
    throw new ApiError(403, 'Only the doctor who diagnosed this consultation may issue a prescription for it.');
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, 'items (a non-empty array of medicines) is required.');
  }
  for (const item of items) {
    if (!item.medicineName || !item.dosage) {
      throw new ApiError(400, 'Each item requires medicineName and dosage.');
    }
  }

  const [created] = await db('prescriptions')
    .insert({
      consultation_id: id,
      patient_id: consultation.patient_id,
      doctor_id: doctorId,
      diagnosis_summary: diagnosisSummary || consultation.diagnosis,
      remarks: remarks || null,
      follow_up_date: followUpDate || null,
      follow_up_instructions: followUpInstructions || null,
      date_issued: new Date().toISOString().slice(0, 10),
    })
    .returning(['id']);

  await db('prescription_items').insert(
    items.map((item) => ({
      prescription_id: created.id,
      medicine_name: item.medicineName,
      dosage: item.dosage,
      instructions: item.instructions || null,
      quantity: item.quantity || null,
    }))
  );

  await auditLog.write({
    userId: doctorId,
    action: 'prescription.issue',
    entityType: 'consultation',
    entityId: id,
    newValue: { prescriptionId: created.id, itemCount: items.length },
    ipAddress,
  });

  return getConsultation(id);
}

async function addEducationLog(id, { instructionsGiven, materialsProvided, givenBy, ipAddress }) {
  const consultation = await getConsultation(id);
  if (!instructionsGiven) {
    throw new ApiError(400, 'instructionsGiven is required.');
  }

  await db('patient_education_logs').insert({
    patient_id: consultation.patient_id,
    source_type: 'consultation',
    source_id: id,
    instructions_given: instructionsGiven,
    materials_provided: materialsProvided || null,
    given_by: givenBy,
  });

  await auditLog.write({
    userId: givenBy,
    action: 'patienteducation.record',
    entityType: 'consultation',
    entityId: id,
    ipAddress,
  });

  return getConsultation(id);
}

async function addFollowUp(id, { scheduledDate, purpose, createdBy, ipAddress }) {
  const consultation = await getConsultation(id);
  if (!scheduledDate || !purpose) {
    throw new ApiError(400, 'scheduledDate and purpose are required.');
  }

  await db('follow_ups').insert({
    patient_id: consultation.patient_id,
    source_type: 'consultation',
    source_id: id,
    scheduled_date: scheduledDate,
    purpose,
    created_by: createdBy,
  });

  await auditLog.write({
    userId: createdBy,
    action: 'followup.schedule',
    entityType: 'consultation',
    entityId: id,
    newValue: { scheduledDate, purpose },
    ipAddress,
  });

  return getConsultation(id);
}

async function updateFollowUpStatus(id, followUpId, { status, notes, actingUserId, ipAddress }) {
  const validStatuses = ['completed', 'missed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
  }

  const followUp = await db('follow_ups').where({ id: followUpId, source_type: 'consultation', source_id: id }).first();
  if (!followUp) {
    throw new ApiError(404, 'Follow-up not found for this consultation.');
  }

  await db('follow_ups')
    .where({ id: followUpId })
    .update({
      status,
      notes: notes || followUp.notes,
      completed_at: status === 'completed' ? db.fn.now() : followUp.completed_at,
    });

  await auditLog.write({
    userId: actingUserId,
    action: 'followup.update_status',
    entityType: 'consultation',
    entityId: id,
    newValue: { followUpId, status },
    ipAddress,
  });

  return getConsultation(id);
}

module.exports = {
  createConsultation,
  getConsultation,
  listConsultationsForPatient,
  recordDiagnosis,
  completeConsultation,
  issuePrescription,
  addEducationLog,
  addFollowUp,
  updateFollowUpStatus,
};
