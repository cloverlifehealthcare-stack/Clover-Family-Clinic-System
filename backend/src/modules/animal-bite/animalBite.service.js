const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const VALID_CATEGORIES = ['I', 'II', 'III'];

async function getRecord(id) {
  const record = await db('animal_bite_records').where({ id }).first();
  if (!record) {
    throw new ApiError(404, 'Animal bite record not found.');
  }

  const [doses, rig, education, followUps] = await Promise.all([
    db('abc_treatment_doses').where({ animal_bite_record_id: id }).orderBy('dose_number'),
    db('abc_rig_administrations').where({ animal_bite_record_id: id }).first(),
    db('patient_education_logs').where({ source_type: 'animal_bite', source_id: id }).orderBy('given_at', 'desc'),
    db('follow_ups').where({ source_type: 'animal_bite', source_id: id }).orderBy('scheduled_date'),
  ]);

  return { ...record, doses, rig: rig || null, educationLogs: education, followUps };
}

async function listRecordsForPatient(patientId) {
  return db('animal_bite_records').where({ patient_id: patientId }).orderBy('visit_date', 'desc');
}

async function createRecord(input) {
  const {
    patientId, visitDate, dateOfExposure, timeOfExposure, animalType, animalOwnership,
    animalVaccinationStatus, biteLocation, woundDescription, previousRabiesVaccination,
    vitalSigns, assessedBy, ipAddress,
  } = input;

  const patient = await db('patients').where({ id: patientId }).first();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }

  const [created] = await db('animal_bite_records')
    .insert({
      patient_id: patientId,
      visit_date: visitDate,
      date_of_exposure: dateOfExposure,
      time_of_exposure: timeOfExposure || null,
      animal_type: animalType,
      animal_ownership: animalOwnership || null,
      animal_vaccination_status: animalVaccinationStatus || null,
      bite_location: biteLocation,
      wound_description: woundDescription,
      previous_rabies_vaccination: previousRabiesVaccination || null,
      vital_signs: JSON.stringify(vitalSigns),
      assessed_by: assessedBy,
      status: 'assessed',
    })
    .returning(['id']);

  await auditLog.write({
    userId: assessedBy,
    action: 'animalbite.create',
    entityType: 'animal_bite_record',
    entityId: created.id,
    newValue: { patientId, dateOfExposure, animalType, biteLocation },
    ipAddress,
  });

  return getRecord(created.id);
}

async function recordDiagnosis(id, { exposureCategory, doctorNotes, treatmentDecision, doctorId, ipAddress }) {
  if (!VALID_CATEGORIES.includes(exposureCategory)) {
    throw new ApiError(400, `exposureCategory must be one of: ${VALID_CATEGORIES.join(', ')}`);
  }

  const before = await getRecord(id);

  await db('animal_bite_records').where({ id }).update({
    exposure_category: exposureCategory,
    doctor_notes: doctorNotes || null,
    treatment_decision: treatmentDecision || null,
    doctor_id: doctorId,
  });

  await auditLog.write({
    userId: doctorId,
    action: 'animalbite.diagnosis_recorded',
    entityType: 'animal_bite_record',
    entityId: id,
    oldValue: { exposureCategory: before.exposure_category },
    newValue: { exposureCategory, treatmentDecision },
    ipAddress,
  });

  return getRecord(id);
}

async function ensureDiagnosed(record) {
  if (!record.exposure_category) {
    throw new ApiError(400, "Doctor's diagnosis (exposure category) must be recorded before treatment can be given.");
  }
}

async function promoteToInTreatment(id) {
  await db('animal_bite_records').where({ id, status: 'assessed' }).update({ status: 'in_treatment' });
}

async function addDose(id, input) {
  const { doseNumber, vaccineName, batchLotNumber, doseAmount, anatomicalSite, scheduledDate, administerNow, administeredBy, ipAddress } = input;

  const record = await getRecord(id);
  await ensureDiagnosed(record);

  if (record.exposure_category === 'I') {
    throw new ApiError(400, 'WHO Category I exposures do not require vaccination — wound management only.');
  }

  // Not `!doseNumber` — dose 0 (the very first rabies vaccine dose, given Day 0) is a real,
  // common value, and 0 is falsy in JS. Must check for absence explicitly.
  if (doseNumber === undefined || doseNumber === null || !vaccineName) {
    throw new ApiError(400, 'doseNumber and vaccineName are required.');
  }

  const isAdministeredNow = administerNow || !scheduledDate;

  const [created] = await db('abc_treatment_doses')
    .insert({
      animal_bite_record_id: id,
      dose_number: doseNumber,
      vaccine_name: vaccineName,
      batch_lot_number: batchLotNumber || null,
      dose_amount: doseAmount || null,
      anatomical_site: anatomicalSite || null,
      scheduled_date: scheduledDate || null,
      administered_by: isAdministeredNow ? administeredBy : null,
      administered_at: isAdministeredNow ? db.fn.now() : null,
      status: isAdministeredNow ? 'administered' : 'scheduled',
    })
    .onConflict(['animal_bite_record_id', 'dose_number'])
    .ignore()
    .returning(['id']);

  if (!created) {
    throw new ApiError(409, `Dose ${doseNumber} already exists for this record.`);
  }

  if (isAdministeredNow) {
    await promoteToInTreatment(id);
  }

  await auditLog.write({
    userId: administeredBy,
    action: isAdministeredNow ? 'animalbite.dose_administered' : 'animalbite.dose_scheduled',
    entityType: 'animal_bite_record',
    entityId: id,
    newValue: { doseNumber, vaccineName, status: isAdministeredNow ? 'administered' : 'scheduled' },
    ipAddress,
  });

  return getRecord(id);
}

async function administerDose(id, doseId, input) {
  const { batchLotNumber, doseAmount, anatomicalSite, administeredBy, ipAddress } = input;

  const dose = await db('abc_treatment_doses').where({ id: doseId, animal_bite_record_id: id }).first();
  if (!dose) {
    throw new ApiError(404, 'Dose not found for this record.');
  }
  if (dose.status !== 'scheduled') {
    throw new ApiError(400, `Dose is already ${dose.status}, cannot administer.`);
  }

  await db('abc_treatment_doses').where({ id: doseId }).update({
    status: 'administered',
    administered_by: administeredBy,
    administered_at: db.fn.now(),
    ...(batchLotNumber ? { batch_lot_number: batchLotNumber } : {}),
    ...(doseAmount ? { dose_amount: doseAmount } : {}),
    ...(anatomicalSite ? { anatomical_site: anatomicalSite } : {}),
  });

  await promoteToInTreatment(id);

  await auditLog.write({
    userId: administeredBy,
    action: 'animalbite.dose_administered',
    entityType: 'animal_bite_record',
    entityId: id,
    newValue: { doseNumber: dose.dose_number },
    ipAddress,
  });

  return getRecord(id);
}

async function addRig(id, input) {
  const { rigProductName, batchLotNumber, patientWeightKg, calculatedDose, siteInfiltratedAmount, imInjectedAmount, administeredBy, ipAddress } = input;

  const record = await getRecord(id);
  await ensureDiagnosed(record);

  if (record.exposure_category !== 'III') {
    throw new ApiError(400, 'Rabies immunoglobulin is only indicated for WHO Category III exposures.');
  }
  if (record.rig) {
    throw new ApiError(409, 'RIG has already been administered for this record.');
  }
  if (!rigProductName || !patientWeightKg || !calculatedDose) {
    throw new ApiError(400, 'rigProductName, patientWeightKg, and calculatedDose are required.');
  }

  await db('abc_rig_administrations').insert({
    animal_bite_record_id: id,
    rig_product_name: rigProductName,
    batch_lot_number: batchLotNumber || null,
    patient_weight_kg: patientWeightKg,
    calculated_dose: calculatedDose,
    site_infiltrated_amount: siteInfiltratedAmount || null,
    im_injected_amount: imInjectedAmount || null,
    administered_by: administeredBy,
  });

  await promoteToInTreatment(id);

  await auditLog.write({
    userId: administeredBy,
    action: 'animalbite.rig_administered',
    entityType: 'animal_bite_record',
    entityId: id,
    newValue: { rigProductName, patientWeightKg },
    ipAddress,
  });

  return getRecord(id);
}

async function completeRecord(id, { actingUserId, ipAddress }) {
  await getRecord(id); // 404s if missing
  await db('animal_bite_records').where({ id }).update({ status: 'completed' });

  await auditLog.write({
    userId: actingUserId,
    action: 'animalbite.completed',
    entityType: 'animal_bite_record',
    entityId: id,
    ipAddress,
  });

  return getRecord(id);
}

async function addEducationLog(id, { instructionsGiven, materialsProvided, givenBy, ipAddress }) {
  const record = await getRecord(id);
  if (!instructionsGiven) {
    throw new ApiError(400, 'instructionsGiven is required.');
  }

  await db('patient_education_logs').insert({
    patient_id: record.patient_id,
    source_type: 'animal_bite',
    source_id: id,
    instructions_given: instructionsGiven,
    materials_provided: materialsProvided || null,
    given_by: givenBy,
  });

  await auditLog.write({
    userId: givenBy,
    action: 'patienteducation.record',
    entityType: 'animal_bite_record',
    entityId: id,
    ipAddress,
  });

  return getRecord(id);
}

async function addFollowUp(id, { scheduledDate, purpose, doseNumber, createdBy, ipAddress }) {
  const record = await getRecord(id);
  if (!scheduledDate || !purpose) {
    throw new ApiError(400, 'scheduledDate and purpose are required.');
  }

  await db('follow_ups').insert({
    patient_id: record.patient_id,
    source_type: 'animal_bite',
    source_id: id,
    dose_number: doseNumber || null,
    scheduled_date: scheduledDate,
    purpose,
    created_by: createdBy,
  });

  await auditLog.write({
    userId: createdBy,
    action: 'followup.schedule',
    entityType: 'animal_bite_record',
    entityId: id,
    newValue: { scheduledDate, purpose },
    ipAddress,
  });

  return getRecord(id);
}

async function updateFollowUpStatus(id, followUpId, { status, notes, actingUserId, ipAddress }) {
  const validStatuses = ['completed', 'missed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    throw new ApiError(400, `status must be one of: ${validStatuses.join(', ')}`);
  }

  const followUp = await db('follow_ups').where({ id: followUpId, source_type: 'animal_bite', source_id: id }).first();
  if (!followUp) {
    throw new ApiError(404, 'Follow-up not found for this record.');
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
    entityType: 'animal_bite_record',
    entityId: id,
    newValue: { followUpId, status },
    ipAddress,
  });

  return getRecord(id);
}

module.exports = {
  createRecord,
  getRecord,
  listRecordsForPatient,
  recordDiagnosis,
  addDose,
  administerDose,
  addRig,
  completeRecord,
  addEducationLog,
  addFollowUp,
  updateFollowUpStatus,
};
