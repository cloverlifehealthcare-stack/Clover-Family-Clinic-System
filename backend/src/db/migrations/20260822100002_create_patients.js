// Matches docs/clover-architecture.md §4.2 `patients` table exactly.
exports.up = function up(knex) {
  return knex.schema.createTable('patients', (table) => {
    table.increments('id').primary();
    table.string('patient_code', 20).notNullable().unique();

    table.string('first_name', 100).notNullable();
    table.string('middle_name', 100);
    table.string('last_name', 100).notNullable();
    table.date('date_of_birth').notNullable();
    table.string('sex', 20);
    table.text('address');
    table.string('contact_number', 30);
    table.string('email', 255);

    table.string('emergency_contact_name', 150);
    table.string('emergency_contact_number', 30);
    table.string('emergency_contact_relationship', 100);

    table.text('medical_history_notes');

    // Required (enforced in the service layer, not a DB constraint) when the patient is a
    // minor at registration time — see docs/clover-architecture.md §0.
    table.string('guardian_name', 150);
    table.string('guardian_relationship', 100);
    table.string('guardian_contact_number', 30);

    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamps(true, true);

    // Backs the duplicate-patient soft-warn check (docs/clover-architecture.md §6).
    table.index(['last_name', 'first_name', 'date_of_birth']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('patients');
};
