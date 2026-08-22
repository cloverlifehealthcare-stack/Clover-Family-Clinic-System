const db = require('../../db/knex');
const asyncHandler = require('../../utils/asyncHandler');
const ApiError = require('../../utils/ApiError');

const list = asyncHandler(async (req, res) => {
  const query = db('services').orderBy('category').orderBy('name');
  if (req.query.activeOnly !== 'false') {
    query.where({ is_active: true });
  }
  res.json(await query);
});

const create = asyncHandler(async (req, res) => {
  const { name, category, defaultPrice } = req.body;
  if (!name || !category || defaultPrice === undefined || defaultPrice === null) {
    throw new ApiError(400, 'name, category, and defaultPrice are required.');
  }

  const [created] = await db('services')
    .insert({ name, category, default_price: defaultPrice })
    .returning(['id']);
  res.status(201).json(await db('services').where({ id: created.id }).first());
});

const update = asyncHandler(async (req, res) => {
  const service = await db('services').where({ id: req.params.id }).first();
  if (!service) {
    throw new ApiError(404, 'Service not found.');
  }

  const changes = {};
  if (req.body.name !== undefined) changes.name = req.body.name;
  if (req.body.category !== undefined) changes.category = req.body.category;
  if (req.body.defaultPrice !== undefined) changes.default_price = req.body.defaultPrice;
  if (req.body.isActive !== undefined) changes.is_active = req.body.isActive;

  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'No editable fields provided.');
  }

  await db('services').where({ id: req.params.id }).update(changes);
  res.json(await db('services').where({ id: req.params.id }).first());
});

module.exports = { list, create, update };
