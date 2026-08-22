// Phase 2, third module — same situation as Inventory and Scheduling: docs/clover-
// architecture.md §2 only names "Follow-up automation, reminders (SMS/email)"; §0 confirms
// the channels (Globe for SMS, Gmail for email) but not a schema. This design is worked out
// inline, flagged in the backend README, not a transcribed spec.
//
// One row per (source, channel) actually attempted — the unique constraint below is what
// makes the reminder job idempotent: running it twice in the same day never double-sends the
// same follow-up/appointment reminder on the same channel, whether it succeeded or failed
// (a failed send still counts as "attempted" rather than being retried indefinitely by every
// run — a deliberate simplification for Phase 2, not a retry queue).
exports.up = async function up(knex) {
  await knex.schema.createTable('reminder_logs', (table) => {
    table.increments('id').primary();
    table.string('source_type', 20).notNullable(); // follow_up | appointment
    table.integer('source_id').notNullable(); // polymorphic, like patient_education_logs/follow_ups
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');

    table.string('channel', 10).notNullable(); // sms | email
    table.string('recipient', 255).notNullable(); // phone number or email address actually used
    table.text('message').notNullable();
    table.string('status', 10).notNullable(); // sent | failed
    table.text('provider_response');
    table.timestamp('sent_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['source_type', 'source_id', 'channel']);
    table.index(['patient_id']);
  });

  await knex.raw(`
    ALTER TABLE reminder_logs
    ADD CONSTRAINT reminder_logs_source_type_check CHECK (source_type IN ('follow_up', 'appointment')),
    ADD CONSTRAINT reminder_logs_channel_check CHECK (channel IN ('sms', 'email')),
    ADD CONSTRAINT reminder_logs_status_check CHECK (status IN ('sent', 'failed'))
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('reminder_logs');
};
