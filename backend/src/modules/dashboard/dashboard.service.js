const db = require('../../db/knex');
const reportsService = require('../reports/reports.service');
const inventoryService = require('../inventory/inventory.service');
const schedulingService = require('../scheduling/scheduling.service');
const appointmentsService = require('../appointments/appointments.service');
const financialService = require('../financial/financial.service');

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

// No dedicated read query exists elsewhere for "follow-ups due" (reminders.service.js's
// findDue*Reminders functions answer a different question — "what's due in exactly N days,
// for the SMS/email job" — and aren't exported). Counts only, not a patient-identifying list,
// gated the same as Daily Activity (reports.view) since it's the same kind of operational
// count, not PHI.
async function getFollowUpCounts(today) {
  const [dueTodayRow, overdueRow] = await Promise.all([
    db('follow_ups').where('status', 'upcoming').andWhere('scheduled_date', today).count('* as count').first(),
    db('follow_ups').where('status', 'upcoming').andWhere('scheduled_date', '<', today).count('* as count').first(),
  ]);
  return { dueToday: Number(dueTodayRow.count), overdue: Number(overdueRow.count) };
}

/**
 * Aggregates today's snapshot from several existing modules into one dashboard payload. Not
 * gated by a single permission at the route level — each section is only computed (and
 * included) if the caller's effective permissions include that section's own existing gate
 * (reports.view, inventory.view, appointments.view, scheduling.view, financial.view), the same
 * permission each section's own dedicated endpoint already requires. A user with none of these
 * still gets a 200 with every section null, rather than a 403 — the dashboard is a landing page
 * every logged-in user can load, just showing less depending on what they're allowed to see
 * elsewhere in the app.
 */
async function getDashboard(actingUser, permissions) {
  const today = todayDateString();
  const has = (code) => permissions.includes(code);

  const [dailyActivity, inventoryAlerts, followUps, appointmentsToday, shiftsToday, financialSummary] = await Promise.all([
    has('reports.view') ? reportsService.getDailyActivity(today) : null,
    has('inventory.view') ? inventoryService.getAlerts({ expiringWithinDays: 30 }) : null,
    has('reports.view') ? getFollowUpCounts(today) : null,
    has('appointments.view')
      ? appointmentsService.listAppointments({ date: today }, { roleName: actingUser.roleName, id: actingUser.id })
      : null,
    has('scheduling.view') ? schedulingService.listShifts({ date: today }, { id: actingUser.id, permissions }) : null,
    has('financial.view') ? financialService.getSummary({ startDate: today, endDate: today }) : null,
  ]);

  return {
    date: today,
    dailyActivity,
    inventoryAlerts: inventoryAlerts && {
      lowStockCount: inventoryAlerts.lowStock.length,
      expiringSoonCount: inventoryAlerts.expiringSoon.length,
      lowStock: inventoryAlerts.lowStock.slice(0, 5),
      expiringSoon: inventoryAlerts.expiringSoon.slice(0, 5),
    },
    followUps,
    appointmentsToday: appointmentsToday && { count: appointmentsToday.length, items: appointmentsToday.slice(0, 5) },
    shiftsToday: shiftsToday && { count: shiftsToday.length, items: shiftsToday.slice(0, 5) },
    financialSummary,
  };
}

module.exports = { getDashboard };
