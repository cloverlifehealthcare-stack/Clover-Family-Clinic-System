const usersService = require('./users.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  res.json(await usersService.listUsers());
});

const get = asyncHandler(async (req, res) => {
  res.json(await usersService.getUser(req.params.id));
});

const create = asyncHandler(async (req, res) => {
  const { email, password, fullName, contactNumber, role } = req.body;
  if (!email || !password || !fullName || !role) {
    throw new ApiError(400, 'email, password, fullName, and role are required.');
  }

  const user = await usersService.createUser({
    email, password, fullName, contactNumber, roleName: role,
    createdBy: req.user.id, ipAddress: req.ip,
  });
  res.status(201).json(user);
});

const deactivate = asyncHandler(async (req, res) => {
  const user = await usersService.setActive({
    id: req.params.id, isActive: false, actingUserId: req.user.id, ipAddress: req.ip,
  });
  res.json(user);
});

const reactivate = asyncHandler(async (req, res) => {
  const user = await usersService.setActive({
    id: req.params.id, isActive: true, actingUserId: req.user.id, ipAddress: req.ip,
  });
  res.json(user);
});

module.exports = { list, get, create, deactivate, reactivate };
