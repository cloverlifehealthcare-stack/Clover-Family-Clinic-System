const db = require('../db/knex');
const patientTokenService = require('../services/patientToken.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Patient-portal equivalent of auth.middleware's requireAuth — verifies a patient access
 * token (separate secret, separate `patient_accounts` table) and re-fetches the account fresh
 * so a deactivated account is rejected immediately, same reasoning as the staff version.
 * Deliberately a completely separate function, not a shared one with a role branch: mixing the
 * two auth domains in one code path is exactly the kind of thing that eventually lets a staff
 * token work on a patient route or vice versa by accident.
 */
const requirePatientAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or malformed Authorization header.');
  }

  let payload;
  try {
    payload = patientTokenService.verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired access token.');
  }

  if (payload.type !== 'patient') {
    throw new ApiError(401, 'Invalid token type.');
  }

  const account = await db('patient_accounts')
    .where({ 'patient_accounts.id': payload.sub })
    .select('id', 'patient_id', 'is_active')
    .first();

  if (!account || !account.is_active) {
    throw new ApiError(401, 'Account not found or deactivated.');
  }

  req.patientAccount = { id: account.id, patientId: account.patient_id };
  next();
});

module.exports = { requirePatientAuth };
