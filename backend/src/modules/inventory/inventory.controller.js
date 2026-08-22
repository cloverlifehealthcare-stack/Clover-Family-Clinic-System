const inventoryService = require('./inventory.service');
const asyncHandler = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  res.json(await inventoryService.listItems({ activeOnly: req.query.activeOnly !== 'false' }));
});

const create = asyncHandler(async (req, res) => {
  const item = await inventoryService.createItem(req.body);
  res.status(201).json(item);
});

const get = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getItem(req.params.id));
});

const update = asyncHandler(async (req, res) => {
  res.json(await inventoryService.updateItem(req.params.id, req.body));
});

const receiveBatch = asyncHandler(async (req, res) => {
  const item = await inventoryService.receiveBatch(req.params.id, {
    ...req.body,
    receivedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.status(201).json(item);
});

const adjustBatch = asyncHandler(async (req, res) => {
  const item = await inventoryService.adjustBatch(req.params.batchId, {
    ...req.body,
    adjustedBy: req.user.id,
    ipAddress: req.ip,
  });
  res.json(item);
});

const alerts = asyncHandler(async (req, res) => {
  res.json(await inventoryService.getAlerts({ expiringWithinDays: req.query.expiringWithinDays }));
});

module.exports = { list, create, get, update, receiveBatch, adjustBatch, alerts };
