const remindersService = require('./reminders.service');
const asyncHandler = require('../../utils/asyncHandler');

const run = asyncHandler(async (req, res) => {
  const summary = await remindersService.runReminderJob({
    daysBefore: req.body.daysBefore !== undefined ? Number(req.body.daysBefore) : undefined,
    triggeredBy: req.user.id,
    ipAddress: req.ip,
  });
  res.json(summary);
});

// Vercel Cron's daily trigger — no staff user, so triggeredBy stays null (auditLog.write
// already supports that, same as an anonymous failed-login entry).
const runCron = asyncHandler(async (req, res) => {
  const summary = await remindersService.runReminderJob({ triggeredBy: null, ipAddress: req.ip });
  res.json(summary);
});

const list = asyncHandler(async (req, res) => {
  res.json(
    await remindersService.listReminderLogs({
      patientId: req.query.patientId,
      sourceType: req.query.sourceType,
      status: req.query.status,
    })
  );
});

module.exports = { run, runCron, list };
