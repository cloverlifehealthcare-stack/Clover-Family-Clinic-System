// docs/clover-architecture.md §4.2 `patient_education_logs` — shared between Animal Bite
// Center (source_type='animal_bite') and Medical Consultation (source_type='consultation',
// not built yet). source_id is a plain integer, not a foreign key, since it points at
// whichever of those two tables source_type names — a polymorphic reference.
exports.up = function up(knex) {
  return knex.schema.createTable('patient_education_logs', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');

    table.string('source_type', 20).notNullable(); // animal_bite | consultation
    table.integer('source_id').notNullable();

    table.text('instructions_given').notNullable();
    table.text('materials_provided');

    table
      .integer('given_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('given_at').notNullable().defaultTo(knex.fn.now());

    table.index(['source_type', 'source_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('patient_education_logs');
};
