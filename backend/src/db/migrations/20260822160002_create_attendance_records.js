// One row per staff member per day: clock_in_at/clock_out_at for self-service time-clock use
// (any staff member clocks their own attendance — see attendance.routes.js), status/notes for
// Management/Admin corrections (marking someone on_leave, absent, or fixing a missed clock-in).
// recorded_by is nullable specifically to distinguish a self-clock ("recorded_by IS NULL") from
// a manual Admin/Management entry.
exports.up = async function up(knex) {
  await knex.schema.createTable('attendance_records', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');

    table.date('attendance_date').notNullable();
    table.timestamp('clock_in_at');
    table.timestamp('clock_out_at');
    table.string('status', 20).notNullable().defaultTo('present'); // present | late | absent | on_leave | half_day
    table.text('notes');

    table
      .integer('recorded_by')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());

    table.unique(['user_id', 'attendance_date']);
  });

  await knex.raw(`
    ALTER TABLE attendance_records
    ADD CONSTRAINT attendance_records_status_check
    CHECK (status IN ('present', 'late', 'absent', 'on_leave', 'half_day'))
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('attendance_records');
};
