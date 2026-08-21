const db = require('../db/knex');

/**
 * Writes one audit_logs row. userId is nullable — e.g. a failed login against an
 * unknown email has no user to attach the entry to (see migration comment).
 */
async function write({
  userId = null,
  action,
  entityType,
  entityId = null,
  oldValue = null,
  newValue = null,
  ipAddress = null,
}) {
  await db('audit_logs').insert({
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: entityId !== null ? String(entityId) : null,
    old_value: oldValue !== null ? JSON.stringify(oldValue) : null,
    new_value: newValue !== null ? JSON.stringify(newValue) : null,
    ip_address: ipAddress,
  });
}

module.exports = { write };
