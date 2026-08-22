const db = require('../../db/knex');
const ApiError = require('../../utils/ApiError');

// Deliberately operational counts only — no revenue/financial figures. Keeping this report
// under a separate reports.view permission (Management + Admin by default) rather than folding
// it into financial.view keeps the documented business rule intact: financial/profit data stays
// restricted to Management (Admin only via an individual override), while day-to-day activity
// counts are fine for Admin to see by default since they run daily operations.
function requireDate(date) {
  if (!date) {
    throw new ApiError(400, 'date is required (YYYY-MM-DD).');
  }
}

async function countByStatus(table, dateColumn, date) {
  const rows = await db(table).where(dateColumn, date).select('status').count('* as count').groupBy('status');
  return rows.reduce((acc, row) => ({ ...acc, [row.status]: Number(row.count) }), {});
}

async function getDailyActivity(date) {
  requireDate(date);

  const [newPatientsRow, animalBiteVisits, consultations, appointments, staffAttendance] = await Promise.all([
    db('patients').whereRaw('created_at::date = ?', [date]).count('* as count').first(),
    countByStatus('animal_bite_records', 'visit_date', date),
    countByStatus('consultations', 'visit_date', date),
    countByStatus('appointments', 'scheduled_date', date),
    countByStatus('attendance_records', 'attendance_date', date),
  ]);

  return {
    date,
    newPatients: Number(newPatientsRow.count),
    animalBiteVisits,
    consultations,
    appointments,
    staffAttendance,
  };
}

const GROUP_BY_UNITS = ['day', 'week', 'month'];

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function requireDateRange(startDate, endDate) {
  if (!startDate || !endDate) {
    throw new ApiError(400, 'startDate and endDate are required (YYYY-MM-DD).');
  }
  if (startDate > endDate) {
    throw new ApiError(400, 'startDate must not be after endDate.');
  }
}

// `unit` is interpolated directly into the raw SQL string, not passed as a bound parameter —
// safe only because it's checked against a fixed whitelist first (GROUP_BY_UNITS), never used
// otherwise. date_trunc() doesn't accept its first argument as a bind parameter in Postgres,
// which is why this can't just be a `?` placeholder like every other value in this file.
function periodExpression(unit, column) {
  return db.raw(`date_trunc('${unit}', ??)::date as period`, [column]);
}

async function groupedByPeriodAndStatus(table, dateColumn, statusColumn, unit, startDate, endDate) {
  return db(table)
    .whereBetween(dateColumn, [startDate, endDate])
    .select(periodExpression(unit, dateColumn), statusColumn)
    .count('* as count')
    .groupByRaw(`1, ${statusColumn}`)
    .orderBy('period');
}

// Reshapes [{period, status, count}, ...] into one object per period: { period, <status>: count, ... }.
// row.period is already a 'YYYY-MM-DD' string — see the comment in getClinicalTrends below.
function pivotByStatus(rows, statusColumn) {
  const byPeriod = new Map();
  for (const row of rows) {
    const key = row.period;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { period: key });
    }
    byPeriod.get(key)[row[statusColumn]] = Number(row.count);
  }
  return [...byPeriod.values()];
}

/**
 * Phase 4, "Advanced Reports" (docs/clover-architecture.md §2 — no spec beyond the name; scope
 * picked via AskUserQuestion: date-range clinical/operational trends, not data export or staff
 * performance, which weren't selected). Extends Daily Activity Reports from a single day to a
 * range, grouped into periods (day/week/month). Still no revenue/financial figures — same
 * reasoning as getDailyActivity above.
 */
async function getClinicalTrends({ startDate, endDate, groupBy }) {
  requireDateRange(startDate, endDate);
  const unit = GROUP_BY_UNITS.includes(groupBy) ? groupBy : 'month';

  const [animalBiteRows, consultationRows, followUpRows, appointmentRows] = await Promise.all([
    db('animal_bite_records')
      .whereBetween('visit_date', [startDate, endDate])
      .select(periodExpression(unit, 'visit_date'), db.raw("coalesce(exposure_category, 'unclassified') as category"))
      .count('* as count')
      .groupByRaw('1, 2')
      .orderBy('period'),
    db('consultations')
      .whereBetween('visit_date', [startDate, endDate])
      .select(periodExpression(unit, 'visit_date'))
      .count('* as count')
      .groupByRaw('1')
      .orderBy('period'),
    groupedByPeriodAndStatus('follow_ups', 'scheduled_date', 'status', unit, startDate, endDate),
    groupedByPeriodAndStatus('appointments', 'scheduled_date', 'status', unit, startDate, endDate),
  ]);

  // row.period is already a plain 'YYYY-MM-DD' string, not a JS Date — the DATE type-parser
  // override in db/knex.js (OID 1082) applies to every DATE-typed column, including this
  // computed date_trunc(...)::date one, the same way it does for visit_date/scheduled_date
  // everywhere else in this codebase.
  const animalBiteByCategory = [];
  const byPeriod = new Map();
  for (const row of animalBiteRows) {
    const key = row.period;
    if (!byPeriod.has(key)) {
      byPeriod.set(key, { period: key });
      animalBiteByCategory.push(byPeriod.get(key));
    }
    byPeriod.get(key)[`category_${row.category}`] = Number(row.count);
  }

  const consultationVolume = consultationRows.map((row) => ({
    period: row.period,
    count: Number(row.count),
  }));

  const followUpCompletion = pivotByStatus(followUpRows, 'status').map((row) => {
    const completed = row.completed || 0;
    const missed = row.missed || 0;
    const cancelled = row.cancelled || 0;
    const upcoming = row.upcoming || 0;
    const decided = completed + missed + cancelled; // excludes upcoming — those haven't happened yet
    return {
      period: row.period,
      completed,
      missed,
      cancelled,
      upcoming,
      completionRate: decided > 0 ? round2(completed / decided) : null,
    };
  });

  const appointmentOutcomes = pivotByStatus(appointmentRows, 'status').map((row) => {
    const scheduled = row.scheduled || 0;
    const checkedIn = row.checked_in || 0;
    const completed = row.completed || 0;
    const cancelled = row.cancelled || 0;
    const noShow = row.no_show || 0;
    const total = scheduled + checkedIn + completed + cancelled + noShow;
    return {
      period: row.period,
      scheduled,
      checkedIn,
      completed,
      cancelled,
      noShow,
      noShowRate: total > 0 ? round2(noShow / total) : null,
      cancellationRate: total > 0 ? round2(cancelled / total) : null,
    };
  });

  return { startDate, endDate, groupBy: unit, animalBiteByCategory, consultationVolume, followUpCompletion, appointmentOutcomes };
}

module.exports = { getDailyActivity, getClinicalTrends };
