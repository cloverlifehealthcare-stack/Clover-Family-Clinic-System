// docs/clover-architecture.md §4.2 `appointments`. Double-booking prevention is a partial
// unique index rather than a plain unique constraint, specifically so a cancelled
// appointment frees up its slot for someone else — a plain unique constraint on
// (doctor_id, scheduled_date, scheduled_time) would permanently block that slot forever
// once any appointment (even a cancelled one) had used it.
exports.up = async function up(knex) {
  await knex.schema.createTable('appointments', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');
    table
      .integer('doctor_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');

    table.string('service_type', 30).notNullable(); // animal_bite | consultation | follow_up_vaccine
    table.date('scheduled_date').notNullable();
    table.time('scheduled_time').notNullable();
    table.integer('slot_minutes').notNullable().defaultTo(15); // fixed at 15 for all types, per §0

    table.string('status', 20).notNullable().defaultTo('scheduled');
    // scheduled -> checked_in -> completed, or scheduled/checked_in -> cancelled/no_show

    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.text('notes');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['doctor_id', 'scheduled_date']);
    table.index(['patient_id']);
  });

  await knex.raw(`
    CREATE UNIQUE INDEX appointments_doctor_slot_unique
    ON appointments (doctor_id, scheduled_date, scheduled_time)
    WHERE status <> 'cancelled'
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('appointments');
};
