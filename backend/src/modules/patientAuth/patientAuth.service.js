const bcrypt = require('bcryptjs');
const db = require('../../db/knex');
const patientTokenService = require('../../services/patientToken.service');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');
const { isMinor } = require('../../utils/age');
const patientsService = require('../patients/patients.service');

const MIN_PASSWORD_LENGTH = 8;

function toAccountRow(account) {
  return { id: account.id, tokenVersion: account.token_version };
}

/**
 * Duplicate-checking already happened in the controller (same possible_duplicate 409 pattern
 * as staff patient creation) before this is called. This always creates a NEW `patients` row —
 * it never links to an existing one, even when the caller confirms the duplicate warning.
 * Auto-linking based on name+DOB (both guessable/public) would let anyone who knows those two
 * facts about an existing patient claim their portal account and read their full medical
 * history — a real PHI exposure, not a hypothetical one, under RA 10173. A patient who already
 * has an in-person record and wants it linked to their new portal account has to go through
 * staff, who can verify identity in person; that linking tool isn't built yet (see README).
 */
async function register({ firstName, lastName, dateOfBirth, contactNumber, email, password, ipAddress }) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (isMinor(dateOfBirth)) {
    throw new ApiError(
      400,
      'The Patient Portal is available to adult patients (18+) only for now. Please visit the clinic in person, or have a parent/guardian coordinate directly with staff.'
    );
  }

  const existingAccount = await db('patient_accounts').where({ email }).first();
  if (existingAccount) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  const patient = await patientsService.createPatient({
    firstName,
    lastName,
    dateOfBirth,
    contactNumber,
    email,
    createdBy: null, // self-registered — see migration comment on patients.created_by
    ipAddress,
  });

  const passwordHash = await bcrypt.hash(password, 12);
  const [created] = await db('patient_accounts').insert({ patient_id: patient.id, email, password_hash: passwordHash }).returning(['id', 'token_version']);

  await auditLog.write({
    action: 'patient_portal.register',
    entityType: 'patient_account',
    entityId: created.id,
    newValue: { patientId: patient.id, email },
    ipAddress,
  });

  const accountRow = toAccountRow(created);
  return {
    accessToken: patientTokenService.signAccessToken(accountRow),
    refreshToken: patientTokenService.signRefreshToken(accountRow),
    patient: { id: patient.id, patientCode: patient.patient_code, firstName: patient.first_name, lastName: patient.last_name },
  };
}

async function login({ email, password, ipAddress }) {
  const account = await db('patient_accounts').where({ email }).first();
  const invalidCredentialsError = () => new ApiError(401, 'Invalid email or password.');

  if (!account) {
    await auditLog.write({ action: 'patient_portal.login_failed', entityType: 'patient_account', entityId: email, ipAddress });
    throw invalidCredentialsError();
  }
  if (!account.is_active) {
    await auditLog.write({ action: 'patient_portal.login_failed_inactive', entityType: 'patient_account', entityId: account.id, ipAddress });
    throw new ApiError(401, 'This account has been deactivated.');
  }
  if (account.locked_until && new Date(account.locked_until) > new Date()) {
    await auditLog.write({ action: 'patient_portal.login_failed_locked', entityType: 'patient_account', entityId: account.id, ipAddress });
    throw new ApiError(423, 'Account temporarily locked due to repeated failed login attempts. Try again later.');
  }

  const passwordMatches = await bcrypt.compare(password, account.password_hash);
  if (!passwordMatches) {
    const attempts = account.failed_login_attempts + 1;
    const update = { failed_login_attempts: attempts };
    if (attempts >= 5) {
      update.locked_until = new Date(Date.now() + 15 * 60 * 1000);
      update.failed_login_attempts = 0;
    }
    await db('patient_accounts').where({ id: account.id }).update(update);
    await auditLog.write({ action: 'patient_portal.login_failed', entityType: 'patient_account', entityId: account.id, ipAddress });
    throw invalidCredentialsError();
  }

  await db('patient_accounts').where({ id: account.id }).update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: db.fn.now(),
  });
  await auditLog.write({ action: 'patient_portal.login_succeeded', entityType: 'patient_account', entityId: account.id, ipAddress });

  const accountRow = toAccountRow(account);
  return {
    accessToken: patientTokenService.signAccessToken(accountRow),
    refreshToken: patientTokenService.signRefreshToken(accountRow),
  };
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = patientTokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }
  if (payload.type !== 'patient') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const account = await db('patient_accounts').where({ id: payload.sub }).first();
  if (!account || !account.is_active || account.token_version !== payload.tokenVersion) {
    throw new ApiError(401, 'Refresh token no longer valid. Please log in again.');
  }

  const accountRow = toAccountRow(account);
  return {
    accessToken: patientTokenService.signAccessToken(accountRow),
    refreshToken: patientTokenService.signRefreshToken(accountRow), // rotated
  };
}

async function logout({ accountId, ipAddress }) {
  await db('patient_accounts').where({ id: accountId }).increment('token_version', 1);
  await auditLog.write({ action: 'patient_portal.logout', entityType: 'patient_account', entityId: accountId, ipAddress });
}

async function getProfile({ id, patientId }) {
  const account = await db('patient_accounts').where({ id }).select('email', 'last_login_at').first();
  const patient = await patientsService.getPatient(patientId, { includeFullFields: true });
  return { ...patient, portalEmail: account.email, lastLoginAt: account.last_login_at };
}

// Deliberately narrow: only contact-info fields, not name/DOB (identity-sensitive — stay
// staff-only to edit) and not portal email/password (no self-service change flow built yet —
// see README known gaps, same trim as the staff password-reset gap flagged since Phase 1).
async function updateProfile({ patientId }, updates, ipAddress) {
  const changes = {};
  if (updates.contactNumber !== undefined) {
    changes.contactNumber = updates.contactNumber;
  }
  if (updates.address !== undefined) {
    changes.address = updates.address;
  }
  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'No editable fields provided (contactNumber, address).');
  }

  return patientsService.updatePatient(patientId, changes, { actingUserId: null, ipAddress });
}

module.exports = { register, login, refresh, logout, getProfile, updateProfile };
