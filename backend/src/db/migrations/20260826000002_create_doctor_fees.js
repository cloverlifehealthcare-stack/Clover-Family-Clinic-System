// Financial Management, Doctor's Fee Options (replaces the flat per-source-type `service_fees`
// default — see the migration dropping that table). One editable row per doctor, applied
// automatically to a visit based on the doctor already recorded on that animal_bite_record/
// consultation (doctor_id, set when the diagnosis is recorded) — not a global default and not
// entered per visit, so billing staff never has to type it in themselves. A doctor with no row
// here yet is treated as ₱0 by the application, not an error — the settings screen always shows
// every current Doctor-role user, whether or not they've had a fee set.
exports.up = async function up(knex) {
  await knex.schema.createTable('doctor_fees', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.decimal('fee_amount', 10, 2).notNullable().defaultTo(0);

    table
      .integer('updated_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE doctor_fees
    ADD CONSTRAINT doctor_fees_fee_amount_check
    CHECK (fee_amount >= 0)
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('doctor_fees');
};
