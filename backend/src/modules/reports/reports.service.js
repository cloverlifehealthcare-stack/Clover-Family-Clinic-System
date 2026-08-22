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

module.exports = { getDailyActivity };
