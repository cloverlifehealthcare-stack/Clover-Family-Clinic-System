const db = require('../../db/knex');

// Phase 4, "Full Audit Log UI (search/filter/export)" (docs/clover-architecture.md §2). The
// underlying data has been captured since Phase 1 (§1.4) — this module is purely the read side.
// Row-scoping mirrors the §3.2 matrix exactly: Management sees every entry, Admin sees only
// entries where they were the acting user ("👁 own actions only"). That's a role check, not a
// separate permission — both roles hold the same audit.view code — same pattern as the "own
// patients"/"own schedule" scoping done elsewhere in each module's service layer, not the RBAC
// middleware.
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;
const MAX_EXPORT_LIMIT = 10000;

function buildQuery({ startDate, endDate, action, entityType, userId }, actingUserId, actingUserRole) {
  let query = db('audit_logs')
    .leftJoin('users', 'users.id', 'audit_logs.user_id')
    .select('audit_logs.*', 'users.full_name as user_name')
    .orderBy('audit_logs.created_at', 'desc');

  if (actingUserRole !== 'Management') {
    query = query.andWhere('audit_logs.user_id', actingUserId);
  } else if (userId) {
    query = query.andWhere('audit_logs.user_id', userId);
  }

  if (startDate) {
    query = query.whereRaw('audit_logs.created_at::date >= ?', [startDate]);
  }
  if (endDate) {
    query = query.whereRaw('audit_logs.created_at::date <= ?', [endDate]);
  }
  if (action) {
    query = query.whereRaw('lower(audit_logs.action) like ?', [`%${action.toLowerCase()}%`]);
  }
  if (entityType) {
    query = query.andWhere('audit_logs.entity_type', entityType);
  }

  return query;
}

async function listAuditLogs(filters, actingUserId, actingUserRole) {
  const limit = Math.min(Number(filters.limit) || DEFAULT_LIMIT, MAX_LIMIT);
  return buildQuery(filters, actingUserId, actingUserRole).limit(limit);
}

async function listEntityTypes(actingUserId, actingUserRole) {
  // clearSelect() drops buildQuery's `audit_logs.*, users.full_name` select list first —
  // without it, `.distinct('entity_type')` only adds a column to that list rather than
  // replacing it, so the query dedupes on every column (i.e. doesn't dedupe at all).
  // clearOrder() is required too: buildQuery's `ORDER BY created_at` isn't in this now-
  // single-column select list, and Postgres rejects `SELECT DISTINCT ... ORDER BY <col not
  // in select list>`.
  const rows = await buildQuery({}, actingUserId, actingUserRole)
    .clearSelect()
    .clearOrder()
    .distinct('audit_logs.entity_type')
    .orderBy('audit_logs.entity_type');
  return rows.map((r) => r.entity_type);
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function exportAuditLogsCsv(filters, actingUserId, actingUserRole) {
  const rows = await buildQuery(filters, actingUserId, actingUserRole).limit(MAX_EXPORT_LIMIT);
  const header = ['Date', 'User', 'Action', 'Entity Type', 'Entity ID', 'IP Address', 'Old Value', 'New Value'];
  const lines = [header.join(',')];
  for (const row of rows) {
    const user = row.user_name || (row.user_id ? `user #${row.user_id}` : 'system');
    lines.push(
      [row.created_at.toISOString(), user, row.action, row.entity_type, row.entity_id, row.ip_address, row.old_value, row.new_value]
        .map(csvEscape)
        .join(',')
    );
  }
  return lines.join('\n');
}

module.exports = { listAuditLogs, listEntityTypes, exportAuditLogsCsv };
