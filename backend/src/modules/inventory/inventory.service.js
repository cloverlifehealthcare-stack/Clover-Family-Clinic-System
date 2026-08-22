const db = require('../../db/knex');
const auditLog = require('../../services/auditLog.service');
const ApiError = require('../../utils/ApiError');

const CATEGORIES = ['vaccine', 'rig', 'medicine', 'supply', 'other'];
const ADJUSTMENT_TYPES = ['correction', 'spoilage', 'expired', 'other'];

async function listItems({ activeOnly = true } = {}) {
  const query = db('inventory_items').orderBy('category').orderBy('name');
  if (activeOnly) {
    query.where({ is_active: true });
  }
  const items = await query;

  // Total remaining across all batches, computed per item — cheaper as one grouped query
  // than N+1 per item.
  const totals = await db('inventory_batches')
    .whereIn('inventory_item_id', items.map((i) => i.id))
    .groupBy('inventory_item_id')
    .select('inventory_item_id')
    .sum({ totalRemaining: 'quantity_remaining' });
  const totalByItemId = Object.fromEntries(totals.map((t) => [t.inventory_item_id, Number(t.totalRemaining)]));

  return items.map((item) => ({
    ...item,
    totalRemaining: totalByItemId[item.id] || 0,
    lowStock: (totalByItemId[item.id] || 0) <= item.reorder_threshold,
  }));
}

async function createItem({ name, category, unit, reorderThreshold }) {
  if (!name || !unit) {
    throw new ApiError(400, 'name and unit are required.');
  }
  if (!CATEGORIES.includes(category)) {
    throw new ApiError(400, `category must be one of: ${CATEGORIES.join(', ')}`);
  }

  const [created] = await db('inventory_items')
    .insert({ name, category, unit, reorder_threshold: reorderThreshold || 0 })
    .returning(['id']);
  return getItem(created.id);
}

async function updateItem(id, { name, reorderThreshold, isActive }) {
  const item = await db('inventory_items').where({ id }).first();
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }

  const changes = {};
  if (name !== undefined) changes.name = name;
  if (reorderThreshold !== undefined) changes.reorder_threshold = reorderThreshold;
  if (isActive !== undefined) changes.is_active = isActive;

  if (Object.keys(changes).length === 0) {
    throw new ApiError(400, 'No editable fields provided.');
  }

  await db('inventory_items').where({ id }).update(changes);
  return getItem(id);
}

async function getItem(id) {
  const item = await db('inventory_items').where({ id }).first();
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }
  const batches = await db('inventory_batches')
    .where({ inventory_item_id: id })
    .orderBy('expiration_date')
    .select();

  const totalRemaining = batches.reduce((sum, b) => sum + b.quantity_remaining, 0);
  return { ...item, batches, totalRemaining, lowStock: totalRemaining <= item.reorder_threshold };
}

async function receiveBatch(itemId, { batchLotNumber, expirationDate, quantityReceived, unitCost, supplier, receivedBy, ipAddress }) {
  const item = await db('inventory_items').where({ id: itemId }).first();
  if (!item) {
    throw new ApiError(404, 'Inventory item not found.');
  }
  if (!batchLotNumber || !quantityReceived || quantityReceived <= 0) {
    throw new ApiError(400, 'batchLotNumber and a positive quantityReceived are required.');
  }

  await db('inventory_batches')
    .insert({
      inventory_item_id: itemId,
      batch_lot_number: batchLotNumber,
      expiration_date: expirationDate || null,
      quantity_received: quantityReceived,
      quantity_remaining: quantityReceived,
      unit_cost: unitCost || null,
      supplier: supplier || null,
      received_by: receivedBy,
    });

  await auditLog.write({
    userId: receivedBy,
    action: 'inventory.batch_received',
    entityType: 'inventory_item',
    entityId: itemId,
    newValue: { batchLotNumber, quantityReceived, expirationDate },
    ipAddress,
  });

  return getItem(itemId);
}

async function adjustBatch(batchId, { adjustmentType, quantityDelta, reason, adjustedBy, ipAddress }) {
  const batch = await db('inventory_batches').where({ id: batchId }).first();
  if (!batch) {
    throw new ApiError(404, 'Batch not found.');
  }
  if (!ADJUSTMENT_TYPES.includes(adjustmentType)) {
    throw new ApiError(400, `adjustmentType must be one of: ${ADJUSTMENT_TYPES.join(', ')}`);
  }
  if (!Number.isInteger(quantityDelta) || quantityDelta === 0) {
    throw new ApiError(400, 'quantityDelta must be a non-zero integer.');
  }
  if (!reason) {
    throw new ApiError(400, 'reason is required.');
  }

  const newRemaining = batch.quantity_remaining + quantityDelta;
  if (newRemaining < 0 || newRemaining > batch.quantity_received) {
    throw new ApiError(400, `Adjustment would set remaining stock to ${newRemaining}, outside the valid range 0–${batch.quantity_received}.`);
  }

  await db('inventory_batches').where({ id: batchId }).update({ quantity_remaining: newRemaining });
  await db('inventory_adjustments').insert({
    inventory_batch_id: batchId,
    adjustment_type: adjustmentType,
    quantity_delta: quantityDelta,
    reason,
    adjusted_by: adjustedBy,
  });

  await auditLog.write({
    userId: adjustedBy,
    action: 'inventory.adjustment',
    entityType: 'inventory_batch',
    entityId: batchId,
    newValue: { adjustmentType, quantityDelta, reason },
    ipAddress,
  });

  return getItem(batch.inventory_item_id);
}

/** Alerts: items at/under reorder threshold, and batches expiring within `days` with stock left. */
async function getAlerts({ expiringWithinDays = 30 } = {}) {
  const items = await listItems({ activeOnly: true });
  const lowStock = items.filter((i) => i.lowStock);

  const expiringSoon = await db('inventory_batches')
    .join('inventory_items', 'inventory_items.id', 'inventory_batches.inventory_item_id')
    .where('inventory_batches.quantity_remaining', '>', 0)
    .andWhere('inventory_batches.expiration_date', '<=', db.raw(`CURRENT_DATE + INTERVAL '${Number(expiringWithinDays)} days'`))
    .select(
      'inventory_batches.id',
      'inventory_batches.batch_lot_number',
      'inventory_batches.expiration_date',
      'inventory_batches.quantity_remaining',
      'inventory_items.name as item_name'
    )
    .orderBy('inventory_batches.expiration_date');

  return { lowStock, expiringSoon };
}

/**
 * Called from animalBite.service.js when a dose/RIG administration references a tracked
 * batch. Not exposed as its own route — it's an internal consumption step, distinct from
 * the manual adjustBatch() above, which is why it isn't logged to inventory_adjustments
 * (that table is for exceptions; this is routine, and the dose/RIG record itself, which
 * carries inventory_batch_id, is the audit trail for it).
 */
async function consumeFromBatch(batchId, quantity = 1) {
  const batch = await db('inventory_batches').where({ id: batchId }).first();
  if (!batch) {
    throw new ApiError(404, 'Inventory batch not found.');
  }
  if (batch.quantity_remaining < quantity) {
    throw new ApiError(400, `Insufficient stock in batch ${batch.batch_lot_number}: ${batch.quantity_remaining} remaining.`);
  }
  await db('inventory_batches').where({ id: batchId }).update({ quantity_remaining: batch.quantity_remaining - quantity });
}

module.exports = {
  listItems,
  createItem,
  updateItem,
  getItem,
  receiveBatch,
  adjustBatch,
  getAlerts,
  consumeFromBatch,
};
