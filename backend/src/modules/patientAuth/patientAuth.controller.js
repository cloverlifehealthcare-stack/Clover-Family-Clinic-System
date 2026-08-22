const patientAuthService = require('./patientAuth.service');
const patientsService = require('../patients/patients.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const REQUIRED_REGISTER_FIELDS = ['firstName', 'lastName', 'dateOfBirth', 'email', 'password'];

// Same possible_duplicate 409 pattern as staff patient creation (patients.controller.js) —
// the check lives in the controller there too, so this mirrors it rather than diverging.
const register = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_REGISTER_FIELDS) {
    if (!req.body[field]) {
      throw new ApiError(400, `${field} is required.`);
    }
  }

  if (!req.body.confirmDuplicate) {
    const duplicates = await patientsService.findPotentialDuplicates({
      firstName: req.body.firstName,
      lastName: req.body.lastName,
      dateOfBirth: req.body.dateOfBirth,
    });

    if (duplicates.length > 0) {
      return res.status(409).json({
        error: 'possible_duplicate',
        message:
          'A patient with this name and date of birth already exists in our records. If that was a past visit ' +
          'of yours, please call the clinic to have staff link your history to a new portal account instead of ' +
          'registering separately. If this is a different person, resubmit with confirmDuplicate: true.',
        possibleDuplicates: duplicates,
      });
    }
  }

  const result = await patientAuthService.register({ ...req.body, ipAddress: req.ip });
  return res.status(201).json(result);
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required.');
  }
  res.json(await patientAuthService.login({ email, password, ipAddress: req.ip }));
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    throw new ApiError(400, 'refreshToken is required.');
  }
  res.json(await patientAuthService.refresh({ refreshToken }));
});

const logout = asyncHandler(async (req, res) => {
  await patientAuthService.logout({ accountId: req.patientAccount.id, ipAddress: req.ip });
  res.status(204).send();
});

const me = asyncHandler(async (req, res) => {
  res.json(await patientAuthService.getProfile(req.patientAccount));
});

const updateMe = asyncHandler(async (req, res) => {
  res.json(await patientAuthService.updateProfile(req.patientAccount, req.body, req.ip));
});

module.exports = { register, login, refresh, logout, me, updateMe };
