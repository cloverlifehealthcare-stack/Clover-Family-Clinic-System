// docs/clover-architecture.md §4.2 `consultations`. status mirrors the animal_bite_records
// pattern but without an in_treatment stage (no dose administration substep exists here):
// 'assessed' (on create) -> 'diagnosed' (doctor records diagnosis/treatment notes) ->
// 'completed' (explicit action). doctor_id is nullable at creation — the nurse doing the
// initial assessment doesn't necessarily know which doctor will see the patient yet.
exports.up = function up(knex) {
  return knex.schema.createTable('consultations', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');
    table
      .integer('doctor_id')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');

    table.date('visit_date').notNullable();
    table.text('chief_complaint').notNullable();
    table.jsonb('vital_signs').notNullable(); // { bp, temp, pulse, respRate, weight }
    table.text('assessment_notes');
    table.text('diagnosis');
    table.text('treatment_notes');
    table.text('remarks'); // referral notes ("Sec5.1 Referral noted in record") live here — the
    // doc's schema has no dedicated referral column, so this follows it exactly rather than
    // adding one.
    table.date('follow_up_date');

    table.string('status', 20).notNullable().defaultTo('assessed');
    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['patient_id']);
    table.index(['status']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('consultations');
};
