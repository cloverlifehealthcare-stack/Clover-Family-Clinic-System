// docs/clover-architecture.md §4.2 `follow_ups` — same polymorphic source_type/source_id
// pattern as patient_education_logs. Adds created_by/created_at beyond the doc's literal
// field list (not spelled out there) so it's on record who scheduled each follow-up —
// same reasoning as the additions noted in the users migration.
exports.up = function up(knex) {
  return knex.schema.createTable('follow_ups', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');

    table.string('source_type', 20).notNullable(); // animal_bite | consultation
    table.integer('source_id').notNullable();
    table.integer('dose_number'); // nullable — only meaningful for rabies vaccine doses

    table.date('scheduled_date').notNullable();
    table.string('purpose', 255).notNullable();
    table.string('status', 20).notNullable().defaultTo('upcoming'); // upcoming/completed/missed/cancelled
    table.timestamp('completed_at');
    table.text('notes');

    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['source_type', 'source_id']);
    table.index(['scheduled_date', 'status']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('follow_ups');
};
