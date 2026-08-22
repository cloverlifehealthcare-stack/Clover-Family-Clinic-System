const reportsService = require('./reports.service');
const asyncHandler = require('../../utils/asyncHandler');

const getDailyActivity = asyncHandler(async (req, res) => {
  res.json(await reportsService.getDailyActivity(req.query.date));
});

const getClinicalTrends = asyncHandler(async (req, res) => {
  res.json(await reportsService.getClinicalTrends(req.query));
});

module.exports = { getDailyActivity, getClinicalTrends };
