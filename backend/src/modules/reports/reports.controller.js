const reportsService = require('./reports.service');
const asyncHandler = require('../../utils/asyncHandler');

const getDailyActivity = asyncHandler(async (req, res) => {
  res.json(await reportsService.getDailyActivity(req.query.date));
});

module.exports = { getDailyActivity };
