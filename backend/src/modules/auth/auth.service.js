const bcrypt = require('bcryptjs');
const db = require('../../db/knex');
const env = require('../../config/env');
const tokenService = require('../../services/token.service');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

function toUserRow(user) {
  return { id: user.id, roleName: user.role_name, tokenVersion: user.token_version };
}

async function login({ email, password, ipAddress }) {
  const user = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'users.email': email })
    .select(
      'users.id', 'users.password_hash', 'users.is_active', 'users.token_version',
      'users.failed_login_attempts', 'users.locked_until', 'roles.name as role_name'
    )
    .first();

  // Same generic error whether the email doesn't exist or the password is wrong —
  // don't leak which one it was.
  const invalidCredentialsError = () => new ApiError(401, 'Invalid email or password.');

  if (!user) {
    await auditLog.write({ action: 'auth.login_failed', entityType: 'user', entityId: email, ipAddress });
    throw invalidCredentialsError();
  }

  if (!user.is_active) {
    await auditLog.write({ userId: user.id, action: 'auth.login_failed_inactive', entityType: 'user', entityId: user.id, ipAddress });
    throw new ApiError(401, 'This account has been deactivated.');
  }

  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    await auditLog.write({ userId: user.id, action: 'auth.login_failed_locked', entityType: 'user', entityId: user.id, ipAddress });
    throw new ApiError(423, 'Account temporarily locked due to repeated failed login attempts. Try again later.');
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatches) {
    const attempts = user.failed_login_attempts + 1;
    const update = { failed_login_attempts: attempts };

    if (attempts >= env.login.maxAttempts) {
      update.locked_until = new Date(Date.now() + env.login.lockoutMinutes * 60 * 1000);
      update.failed_login_attempts = 0;
    }

    await db('users').where({ id: user.id }).update(update);
    await auditLog.write({ userId: user.id, action: 'auth.login_failed', entityType: 'user', entityId: user.id, ipAddress });
    throw invalidCredentialsError();
  }

  await db('users').where({ id: user.id }).update({
    failed_login_attempts: 0,
    locked_until: null,
    last_login_at: db.fn.now(),
  });
  await auditLog.write({ userId: user.id, action: 'auth.login_succeeded', entityType: 'user', entityId: user.id, ipAddress });

  const userRow = toUserRow(user);
  return {
    accessToken: tokenService.signAccessToken(userRow),
    refreshToken: tokenService.signRefreshToken(userRow),
    user: { id: user.id, role: user.role_name },
  };
}

async function refresh({ refreshToken }) {
  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new ApiError(401, 'Invalid or expired refresh token.');
  }

  const user = await db('users')
    .join('roles', 'roles.id', 'users.role_id')
    .where({ 'users.id': payload.sub })
    .select('users.id', 'users.is_active', 'users.token_version', 'roles.name as role_name')
    .first();

  if (!user || !user.is_active || user.token_version !== payload.tokenVersion) {
    throw new ApiError(401, 'Refresh token no longer valid. Please log in again.');
  }

  const userRow = toUserRow(user);
  return {
    accessToken: tokenService.signAccessToken(userRow),
    refreshToken: tokenService.signRefreshToken(userRow), // rotated
  };
}

/**
 * Invalidates every refresh token issued to this user (there's no per-session token store
 * in Phase 1, so "log out" and "log out everywhere" are the same operation — acceptable for
 * a small single-location staff, revisit if that becomes a problem).
 */
async function logout({ userId, ipAddress }) {
  await db('users').where({ id: userId }).increment('token_version', 1);
  await auditLog.write({ userId, action: 'auth.logout', entityType: 'user', entityId: userId, ipAddress });
}

module.exports = { login, refresh, logout };
