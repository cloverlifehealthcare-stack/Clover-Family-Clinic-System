const db = require('../../db/knex');
const permissionService = require('../../services/permission.service');
const auditLog = require('../../services/auditLog.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const listRoles = asyncHandler(async (req, res) => {
  res.json(await db('roles').select('id', 'name', 'description').orderBy('name'));
});

const listPermissions = asyncHandler(async (req, res) => {
  res.json(await db('permissions').select('id', 'code', 'module', 'description').orderBy(['module', 'code']));
});

const getUserPermissions = asyncHandler(async (req, res) => {
  const codes = await permissionService.getEffectivePermissions(req.params.userId);
  res.json({ userId: Number(req.params.userId), permissions: codes });
});

/**
 * Grants or revokes one permission for one user, on top of their role default — this is
 * the mechanism behind "Management and authorized Admin personnel" from the spec
 * (docs/clover-architecture.md §3.1). Always requires a reason; always audit-logged.
 */
const setOverride = asyncHandler(async (req, res) => {
  const { permissionCode, granted, reason } = req.body;
  const { userId } = req.params;

  if (!permissionCode || typeof granted !== 'boolean' || !reason) {
    throw new ApiError(400, 'permissionCode, granted (boolean), and reason are required.');
  }

  await permissionService.setUserPermissionOverride({
    userId, permissionCode, granted, grantedBy: req.user.id, reason,
  });

  await auditLog.write({
    userId: req.user.id,
    action: granted ? 'permission.grant_override' : 'permission.revoke_override',
    entityType: 'user',
    entityId: userId,
    newValue: { permissionCode, granted, reason },
    ipAddress: req.ip,
  });

  const codes = await permissionService.getEffectivePermissions(userId);
  res.json({ userId: Number(userId), permissions: codes });
});

module.exports = { listRoles, listPermissions, getUserPermissions, setOverride };
