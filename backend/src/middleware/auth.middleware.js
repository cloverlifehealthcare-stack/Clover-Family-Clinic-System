const db = require('../db/knex');
const tokenService = require('../services/token.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Verifies the JWT access token, then re-fetches the user from the database (rather than
 * trusting the token's `role` claim for anything beyond convenience) so a deactivated
 * account is rejected immediately instead of staying valid for the rest of the token's
 * 15-minute lifetime. Permission checks in rbac.middleware always query role/permission
 * data fresh for the same reason.
 */
const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or malformed Authorization header.');
  }

  let payload;
  try {
    payload = tokenService.verifyAccessToken(token);
  } catch {
    throw new ApiError(401, 'Invalid or expired access token.');
  }

  const user = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'users.id': payload.sub })
    .select('users.id', 'users.is_active', 'roles.id as role_id', 'roles.name as role_name')
    .first();

  if (!user || !user.is_active) {
    throw new ApiError(401, 'Account not found or deactivated.');
  }

  req.user = { id: user.id, roleId: user.role_id, roleName: user.role_name };
  next();
});

module.exports = { requireAuth };
