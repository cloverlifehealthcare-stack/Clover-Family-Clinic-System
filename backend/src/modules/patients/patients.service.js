const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');
const { isMinor } = require('../../utils/age');

// "Billing-relevant only" (Cashier, per §3.2) vs. the full record (patients.history.view).
const BASIC_COLUMNS = [
  'id', 'patient_code', 'first_name', 'middle_name', 'last_name',
  'date_of_birth', 'sex', 'contact_number',
];
const FULL_COLUMNS = [
  ...BASIC_COLUMNS,
  'address', 'email',
  'emergency_contact_name', 'emergency_contact_number', 'emergency_contact_relationship',
  'medical_history_notes',
  'guardian_name', 'guardian_relationship', 'guardian_contact_number',
  'created_by', 'created_at', 'updated_at',
];

const EDITABLE_FIELDS = [
  'first_name', 'middle_name', 'last_name', 'date_of_birth', 'sex', 'address',
  'contact_number', 'email', 'emergency_contact_name', 'emergency_contact_number',
  'emergency_contact_relationship', 'medical_history_notes',
  'guardian_name', 'guardian_relationship', 'guardian_contact_number',
];

/**
 * Atomically allocates the next MMYY-NNNN code for the current month (docs/clover-architecture.md
 * §0). The upsert's ON CONFLICT resolution is what makes this safe under concurrent registrations
 * — two staff registering patients at the same moment cannot be handed the same number.
 */
async function nextPatientCode() {
  const now = new Date();
  const yearMonth = `${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getFullYear()).slice(-2)}`;

  const [row] = await db('patient_code_sequences')
    .insert({ year_month: yearMonth, last_number: 1 })
    .onConflict('year_month')
    .merge({ last_number: db.raw('patient_code_sequences.last_number + 1') })
    .returning('last_number');

  return `${yearMonth}-${String(row.last_number).padStart(4, '0')}`;
}

/** Soft-warn duplicate check (docs/clover-architecture.md §6): same name + DOB, not a hard block. */
async function findPotentialDuplicates({ firstName, lastName, dateOfBirth }) {
  return db('patients')
    .whereRaw('lower(first_name) = lower(?)', [firstName])
    .andWhereRaw('lower(last_name) = lower(?)', [lastName])
    .andWhere('date_of_birth', dateOfBirth)
    .select('id', 'patient_code', 'first_name', 'middle_name', 'last_name', 'date_of_birth');
}

function assertGuardianInfoIfMinor({ dateOfBirth, guardianName, guardianRelationship, guardianContactNumber }) {
  if (!isMinor(dateOfBirth)) {
    return;
  }
  if (!guardianName || !guardianRelationship || !guardianContactNumber) {
    throw new ApiError(
      400,
      'guardianName, guardianRelationship, and guardianContactNumber are required when the patient is a minor.'
    );
  }
}

async function createPatient(input) {
  const {
    firstName, middleName, lastName, dateOfBirth, sex, address, contactNumber, email,
    emergencyContactName, emergencyContactNumber, emergencyContactRelationship,
    medicalHistoryNotes, guardianName, guardianRelationship, guardianContactNumber,
    createdBy, ipAddress,
  } = input;

  assertGuardianInfoIfMinor({ dateOfBirth, guardianName, guardianRelationship, guardianContactNumber });

  const patientCode = await nextPatientCode();

  const [created] = await db('patients')
    .insert({
      patient_code: patientCode,
      first_name: firstName,
      middle_name: middleName || null,
      last_name: lastName,
      date_of_birth: dateOfBirth,
      sex: sex || null,
      address: address || null,
      contact_number: contactNumber || null,
      email: email || null,
      emergency_contact_name: emergencyContactName || null,
      emergency_contact_number: emergencyContactNumber || null,
      emergency_contact_relationship: emergencyContactRelationship || null,
      medical_history_notes: medicalHistoryNotes || null,
      guardian_name: guardianName || null,
      guardian_relationship: guardianRelationship || null,
      guardian_contact_number: guardianContactNumber || null,
      created_by: createdBy,
    })
    .returning(['id']);

  await auditLog.write({
    userId: createdBy,
    action: 'patient.create',
    entityType: 'patient',
    entityId: created.id,
    newValue: { patientCode, firstName, lastName, dateOfBirth },
    ipAddress,
  });

  return getPatient(created.id, { includeFullFields: true });
}

async function listPatients({ includeFullFields, search }) {
  const columns = includeFullFields ? FULL_COLUMNS : BASIC_COLUMNS;
  let query = db('patients').select(columns).orderBy('last_name').orderBy('first_name');

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    query = query.where((builder) => {
      builder
        .whereRaw('lower(first_name) like ?', [term])
        .orWhereRaw('lower(last_name) like ?', [term])
        .orWhereRaw('lower(patient_code) like ?', [term.replace(/\s/g, '')]);
    });
  }

  return query;
}

async function getPatient(id, { includeFullFields }) {
  const columns = includeFullFields ? FULL_COLUMNS : BASIC_COLUMNS;
  const patient = await db('patients').where({ id }).select(columns).first();
  if (!patient) {
    throw new ApiError(404, 'Patient not found.');
  }
  return patient;
}

async function updatePatient(id, updates, { actingUserId, ipAddress }) {
  const before = await getPatient(id, { includeFullFields: true });

  const changes = {};
  for (const field of EDITABLE_FIELDS) {
    const camelCase = field.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(updates, camelCase)) {
      changes[field] = updates[camelCase];
    }
  }

  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'No editable fields provided.');
  }

  assertGuardianInfoIfMinor({
    dateOfBirth: changes.date_of_birth || before.date_of_birth,
    guardianName: Object.prototype.hasOwnProperty.call(changes, 'guardian_name') ? changes.guardian_name : before.guardian_name,
    guardianRelationship: Object.prototype.hasOwnProperty.call(changes, 'guardian_relationship') ? changes.guardian_relationship : before.guardian_relationship,
    guardianContactNumber: Object.prototype.hasOwnProperty.call(changes, 'guardian_contact_number') ? changes.guardian_contact_number : before.guardian_contact_number,
  });

  await db('patients').where({ id }).update(changes);

  await auditLog.write({
    userId: actingUserId,
    action: 'patient.update',
    entityType: 'patient',
    entityId: id,
    oldValue: before,
    newValue: changes,
    ipAddress,
  });

  return getPatient(id, { includeFullFields: true });
}

module.exports = {
  createPatient,
  listPatients,
  getPatient,
  updatePatient,
  findPotentialDuplicates,
};
