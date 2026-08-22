// Matches docs/clover-architecture.md §4.2 `animal_bite_records`. `status` reaches
// 'assessed' at creation (the API requires initial-assessment fields up front, so there's
// no reachable "registered but not yet assessed" state via the app — 'registered' exists
// as an enum value per the doc but the service never sets it); 'in_treatment' is set
// automatically on the first dose/RIG administration; 'completed' is an explicit action.
exports.up = function up(knex) {
  return knex.schema.createTable('animal_bite_records', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');

    table.date('visit_date').notNullable();
    table.date('date_of_exposure').notNullable();
    table.time('time_of_exposure');
    table.string('animal_type', 100).notNullable();
    table.string('animal_ownership', 20); // owned/stray/unknown — free text, not enforced as enum
    table.string('animal_vaccination_status', 100);
    table.string('bite_location', 150).notNullable();
    table.text('wound_description').notNullable();

    table.string('exposure_category', 10); // WHO Category I/II/III — set by doctor, nullable until then
    table.text('previous_rabies_vaccination');
    table.jsonb('vital_signs').notNullable(); // { bp, temp, pulse, respRate, weight }

    table
      .integer('assessed_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');

    table.text('doctor_notes');
    table
      .integer('doctor_id')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.text('treatment_decision');

    table.string('status', 20).notNullable().defaultTo('assessed');
    table.timestamps(true, true);

    table.index(['patient_id']);
    table.index(['status']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('animal_bite_records');
};
