const dashboardService = require('./dashboard.service');
const permissionService = require('../../services/permission.service');
const asyncHandler = require('../../utils/asyncHandler');

const getDashboard = asyncHandler(async (req, res) => {
  const permissions = await permissionService.getEffectivePermissions(req.user.id);
  const dashboard = await dashboardService.getDashboard({ id: req.user.id, roleName: req.user.roleName }, permissions);
  res.json(dashboard);
});

module.exports = { getDashboard };
