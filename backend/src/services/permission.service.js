const db = require('../db/knex');

/**
 * Resolves whether a user has a given permission code, per the two-layer model in
 * docs/clover-architecture.md §3.1: a per-user override (grant or explicit revoke) always
 * wins; absent an override, the user's role default applies.
 */
async function userHasPermission(userId, code) {
  const override = await db('user_permissions')
    .join('permissions', 'permissions.id', 'user_permissions.permission_id')
    .where({ 'user_permissions.user_id': userId, 'permissions.code': code })
    .select('user_permissions.granted')
    .first();

  if (override) {
    return override.granted;
  }

  const user = await db('users').where({ id: userId }).select('role_id').first();
  if (!user) {
    return false;
  }

  const roleDefault = await db('role_permissions')
    .join('permissions', 'permissions.id', 'role_permissions.permission_id')
    .where({ 'role_permissions.role_id': user.role_id, 'permissions.code': code })
    .first();

  return !!roleDefault;
}

/** All effective permission codes for a user — role defaults with per-user overrides applied. */
async function getEffectivePermissions(userId) {
  const user = await db('users').where({ id: userId }).select('role_id').first();
  if (!user) {
    return [];
  }

  const roleDefaults = await db('role_permissions')
    .join('permissions', 'permissions.id', 'role_permissions.permission_id')
    .where({ 'role_permissions.role_id': user.role_id })
    .pluck('permissions.code');

  const overrides = await db('user_permissions')
    .join('permissions', 'permissions.id', 'user_permissions.permission_id')
    .where({ 'user_permissions.user_id': userId })
    .select('permissions.code', 'user_permissions.granted');

  const effective = new Set(roleDefaults);
  for (const { code, granted } of overrides) {
    if (granted) {
      effective.add(code);
    } else {
      effective.delete(code);
    }
  }

  return [...effective];
}

/**
 * Sets a per-user override. `granted: true` grants the permission regardless of role default
 * (e.g. "authorized Admin personnel"); `granted: false` explicitly revokes a role default for
 * one user. Always requires a reason — it's audit-logged by the caller (permissions.controller).
 */
async function setUserPermissionOverride({ userId, permissionCode, granted, grantedBy, reason }) {
  const permission = await db('permissions').where({ code: permissionCode }).first();
  if (!permission) {
    throw new Error(`Unknown permission code: ${permissionCode}`);
  }

  await db('user_permissions')
    .insert({
      user_id: userId,
      permission_id: permission.id,
      granted,
      granted_by: grantedBy,
      reason,
    })
    .onConflict(['user_id', 'permission_id'])
    .merge({ granted, granted_by: grantedBy, reason, granted_at: db.fn.now() });
}

module.exports = {
  userHasPermission,
  getEffectivePermissions,
  setUserPermissionOverride,
};
