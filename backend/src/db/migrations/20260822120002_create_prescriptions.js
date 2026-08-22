// docs/clover-architecture.md §4.2 `prescriptions` — "exactly one of the two is set"
// (consultation_id / animal_bite_record_id) is enforced with a real CHECK constraint, not
// just application logic, since this table has two independent creation paths (this module,
// and the animal-bite module for the rarer case of a bite visit needing a prescription).
// No signature field — Phase 1 prescriptions are wet-ink signed after printing (§0).
exports.up = async function up(knex) {
  await knex.schema.createTable('prescriptions', (table) => {
    table.increments('id').primary();
    table
      .integer('consultation_id')
      .references('id')
      .inTable('consultations')
      .onDelete('CASCADE');
    table
      .integer('animal_bite_record_id')
      .references('id')
      .inTable('animal_bite_records')
      .onDelete('CASCADE');
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

    table.text('diagnosis_summary');
    table.text('remarks');
    table.date('follow_up_date');
    table.text('follow_up_instructions');
    table.date('date_issued').notNullable();
    table.timestamp('printed_at');
  });

  await knex.raw(`
    ALTER TABLE prescriptions
    ADD CONSTRAINT prescriptions_exactly_one_source CHECK (
      (consultation_id IS NOT NULL AND animal_bite_record_id IS NULL) OR
      (consultation_id IS NULL AND animal_bite_record_id IS NOT NULL)
    )
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('prescriptions');
};
