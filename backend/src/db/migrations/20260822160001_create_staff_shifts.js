// Phase 2. Like Inventory, docs/clover-architecture.md §2 only names "Staff Scheduling &
// Attendance" as a module — no schema exists yet. This design is worked out inline, flagged
// in the backend README, not a transcribed spec.
//
// Deliberately not wired into appointment booking validation (whether a doctor is actually
// scheduled to work when an appointment is booked against them) — that's a natural next step
// once this exists, but doing it now risks changing Phase 1 appointment behavior that's
// already shipped and tested. Left as a flagged follow-up, not silently skipped.
//
// Multiple shifts per user per day are allowed (no unique constraint) to support split
// shifts. Overnight shifts (crossing midnight) aren't supported in Phase 2 — end_time is
// expected to be later than start_time on the same day; the service layer validates this
// rather than a DB CHECK constraint, which would need to be more permissive than useful.
exports.up = function up(knex) {
  return knex.schema.createTable('staff_shifts', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table.date('shift_date').notNullable();
    table.time('start_time').notNullable();
    table.time('end_time').notNullable();
    table.text('notes');

    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['user_id', 'shift_date']);
    table.index(['shift_date']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('staff_shifts');
};
