const patientsService = require('./patients.service');
const permissionService = require('../../services/permission.service');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

async function canSeeFullRecord(userId) {
  return permissionService.userHasPermission(userId, 'patients.history.view');
}

const list = asyncHandler(async (req, res) => {
  const includeFullFields = await canSeeFullRecord(req.user.id);
  const patients = await patientsService.listPatients({ includeFullFields, search: req.query.search });
  res.json(patients);
});

const get = asyncHandler(async (req, res) => {
  const includeFullFields = await canSeeFullRecord(req.user.id);
  const patient = await patientsService.getPatient(req.params.id, { includeFullFields });
  res.json(patient);
});

const REQUIRED_CREATE_FIELDS = ['firstName', 'lastName', 'dateOfBirth'];

const create = asyncHandler(async (req, res) => {
  for (const field of REQUIRED_CREATE_FIELDS) {
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
          'A patient with the same first name, last name, and date of birth already exists. ' +
          'Confirm this is a different person by resubmitting with confirmDuplicate: true.',
        possibleDuplicates: duplicates,
      });
    }
  }

  const patient = await patientsService.createPatient({
    ...req.body,
    createdBy: req.user.id,
    ipAddress: req.ip,
  });
  return res.status(201).json(patient);
});

const update = asyncHandler(async (req, res) => {
  const patient = await patientsService.updatePatient(req.params.id, req.body, {
    actingUserId: req.user.id,
    ipAddress: req.ip,
  });
  res.json(patient);
});

module.exports = { list, get, create, update };
