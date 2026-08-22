// Backs the atomic MMYY-NNNN patient_code generator (docs/clover-architecture.md §0/§4.2).
// One row per month; `last_number` is incremented via an atomic upsert in
// patients.service.js so concurrent registrations never collide on the same code.
exports.up = function up(knex) {
  return knex.schema.createTable('patient_code_sequences', (table) => {
    table.string('year_month', 4).primary(); // e.g. "0826" = August 2026
    table.integer('last_number').notNullable().defaultTo(0);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('patient_code_sequences');
};
