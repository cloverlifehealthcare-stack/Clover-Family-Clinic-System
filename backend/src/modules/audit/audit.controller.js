const auditService = require('./audit.service');
const asyncHandler = require('../../utils/asyncHandler');

const list = asyncHandler(async (req, res) => {
  res.json(await auditService.listAuditLogs(req.query, req.user.id, req.user.roleName));
});

const listEntityTypes = asyncHandler(async (req, res) => {
  res.json(await auditService.listEntityTypes(req.user.id, req.user.roleName));
});

const exportCsv = asyncHandler(async (req, res) => {
  const csv = await auditService.exportAuditLogsCsv(req.query, req.user.id, req.user.roleName);
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="audit-log-export.csv"');
  res.send(csv);
});

module.exports = { list, listEntityTypes, exportCsv };
