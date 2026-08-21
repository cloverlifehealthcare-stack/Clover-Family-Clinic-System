const authService = require('./auth.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');
const permissionService = require('../../services/permission.service');
const db = require('../../db/knex');

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required.');
  }

  const result = await authService.login({ email, password, ipAddress: req.ip });
  res.json(result);
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, 'refreshToken is required.');
  }

  const result = await authService.refresh({ refreshToken });
  res.json(result);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout({ userId: req.user.id, ipAddress: req.ip });
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  const user = await db('users')
    .where({ id: req.user.id })
    .select('id', 'email', 'full_name', 'contact_number', 'last_login_at')
    .first();
  const permissions = await permissionService.getEffectivePermissions(req.user.id);

  res.json({ ...user, role: req.user.roleName, permissions });
});

module.exports = { login, refresh, logout, me };
