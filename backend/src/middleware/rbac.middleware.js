const permissionService = require('../services/permission.service');
const auditLog = require('../services/auditLog.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Route guard factory: `requirePermission('payment.void')`. Must run after requireAuth.
 * Every denial is audit-logged, per docs/clover-architecture.md §5.4 — a 403 is itself
 * a security-relevant event, not just a failed request.
 *
 * This only answers "does the role/override allow this action at all" — row-level rules
 * (own patients only, own actions only, billing-relevant fields only) are a separate check
 * each module's service layer applies afterward, per §5.4's two-stage flow.
 */
function requirePermission(code) {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required.');
    }

    const allowed = await permissionService.userHasPermission(req.user.id, code);

    if (!allowed) {
      await auditLog.write({
        userId: req.user.id,
        action: 'access.denied',
        entityType: 'permission',
        entityId: code,
        ipAddress: req.ip,
      });
      throw new ApiError(403, 'You do not have permission to perform this action.');
    }

    next();
  });
}

module.exports = { requirePermission };
