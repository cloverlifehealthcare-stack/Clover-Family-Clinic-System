const db = require('../../db/knex');
const env = require('../../config/env');
const auditLog = require('../../services/auditLog.service');
const smsService = require('../../services/notifications/smsProvider');
const emailService = require('../../services/notifications/emailProvider');

const DEFAULT_DAYS_BEFORE = 1;

function targetDateString(daysBefore) {
  const d = new Date();
  d.setDate(d.getDate() + daysBefore);
  return d.toISOString().slice(0, 10);
}

async function findDueFollowUpReminders(daysBefore) {
  return db('follow_ups')
    .join('patients', 'patients.id', 'follow_ups.patient_id')
    .where('follow_ups.status', 'upcoming')
    .andWhere('follow_ups.scheduled_date', targetDateString(daysBefore))
    .select(
      'follow_ups.id',
      'follow_ups.purpose',
      'follow_ups.scheduled_date',
      'patients.id as patient_id',
      'patients.first_name',
      'patients.contact_number',
      'patients.email'
    );
}

async function findDueAppointmentReminders(daysBefore) {
  return db('appointments')
    .join('patients', 'patients.id', 'appointments.patient_id')
    .join('users as doctor_user', 'doctor_user.id', 'appointments.doctor_id')
    .where('appointments.status', 'scheduled')
    .andWhere('appointments.scheduled_date', targetDateString(daysBefore))
    .select(
      'appointments.id',
      'appointments.scheduled_date',
      'appointments.scheduled_time',
      'doctor_user.full_name as doctor_name',
      'patients.id as patient_id',
      'patients.first_name',
      'patients.contact_number',
      'patients.email'
    );
}

/**
 * Sends (or, for now, stub-logs) one reminder and records it, unless a row for this exact
 * (source, channel) already exists — that's what makes running the job twice in a day safe:
 * the unique constraint on reminder_logs would reject a duplicate insert anyway, but checking
 * first avoids sending the message twice before the duplicate insert fails.
 */
async function recordAndSend({ sourceType, sourceId, patientId, channel, recipient, message, subject }) {
  const existing = await db('reminder_logs').where({ source_type: sourceType, source_id: sourceId, channel }).first();
  if (existing) {
    return { skipped: true };
  }

  const result =
    channel === 'sms' ? await smsService.sendSms({ to: recipient, message }) : await emailService.sendEmail({ to: recipient, subject, message });

  await db('reminder_logs').insert({
    source_type: sourceType,
    source_id: sourceId,
    patient_id: patientId,
    channel,
    recipient,
    message,
    status: result.success ? 'sent' : 'failed',
    provider_response: result.providerResponse || null,
  });

  return { skipped: false, success: result.success };
}

function tally(summary, outcome) {
  if (outcome.skipped) summary.skipped += 1;
  else if (outcome.success) summary.sent += 1;
  else summary.failed += 1;
}

const CONTACT_LINE = `For concerns, call ${env.notifications.clinicContactNumber} or email ${env.notifications.clinicContactEmail}.`;

async function sendFollowUpReminders(followUps, summary) {
  for (const f of followUps) {
    const message = `Hi ${f.first_name}, this is a reminder from Clover Family Care that your ${f.purpose} follow-up is scheduled for ${f.scheduled_date}. ${CONTACT_LINE}`;
    if (f.contact_number) {
      // eslint-disable-next-line no-await-in-loop
      tally(summary, await recordAndSend({ sourceType: 'follow_up', sourceId: f.id, patientId: f.patient_id, channel: 'sms', recipient: f.contact_number, message }));
    }
    if (f.email) {
      // eslint-disable-next-line no-await-in-loop
      tally(
        summary,
        await recordAndSend({
          sourceType: 'follow_up',
          sourceId: f.id,
          patientId: f.patient_id,
          channel: 'email',
          recipient: f.email,
          message,
          subject: 'Follow-up reminder — Clover Family Care',
        })
      );
    }
  }
}

async function sendAppointmentReminders(appointments, summary) {
  for (const a of appointments) {
    const message = `Hi ${a.first_name}, reminder: you have an appointment with ${a.doctor_name} at Clover Family Care on ${a.scheduled_date} at ${a.scheduled_time.slice(0, 5)}. See you then!`;
    if (a.contact_number) {
      // eslint-disable-next-line no-await-in-loop
      tally(summary, await recordAndSend({ sourceType: 'appointment', sourceId: a.id, patientId: a.patient_id, channel: 'sms', recipient: a.contact_number, message }));
    }
    if (a.email) {
      // eslint-disable-next-line no-await-in-loop
      tally(
        summary,
        await recordAndSend({
          sourceType: 'appointment',
          sourceId: a.id,
          patientId: a.patient_id,
          channel: 'email',
          recipient: a.email,
          message,
          subject: 'Appointment reminder — Clover Family Care',
        })
      );
    }
  }
}

/**
 * The one entry point — everything else in this file is a helper for this. Not
 * self-scheduling: no cron/interval runs this automatically anywhere in the app. A real
 * deployment should point an external scheduler (a system cron job, a hosted scheduler, or
 * node-cron added later) at POST /api/reminders/run on whatever cadence makes sense (daily,
 * matching daysBefore=1's "tomorrow" framing). Kept manual/explicit for Phase 2 rather than
 * adding a background timer whose interaction with the test suite and dev server lifecycle
 * would need its own care.
 */
async function runReminderJob({ daysBefore = DEFAULT_DAYS_BEFORE, triggeredBy, ipAddress } = {}) {
  const [followUps, appointments] = await Promise.all([findDueFollowUpReminders(daysBefore), findDueAppointmentReminders(daysBefore)]);

  const summary = { sent: 0, failed: 0, skipped: 0 };
  await sendFollowUpReminders(followUps, summary);
  await sendAppointmentReminders(appointments, summary);

  await auditLog.write({
    userId: triggeredBy,
    action: 'reminders.job_run',
    entityType: 'reminder_job',
    newValue: { daysBefore, ...summary },
    ipAddress,
  });

  return summary;
}

async function listReminderLogs({ patientId, sourceType, status } = {}) {
  let query = db('reminder_logs').orderBy('sent_at', 'desc');
  if (patientId) query = query.andWhere('patient_id', patientId);
  if (sourceType) query = query.andWhere('source_type', sourceType);
  if (status) query = query.andWhere('status', status);
  return query;
}

module.exports = { runReminderJob, listReminderLogs };
