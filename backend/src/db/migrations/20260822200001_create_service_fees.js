// Financial Management, "Purchases" report (formerly Sales Ledger — see the financial.service.js
// comment on getPurchases for why it was replaced, not just relabeled). Doctor's Fee is
// configurable per billing_statements.source_type ("Fee per service type" — same fee
// regardless of which doctor performed it, a deliberate scope decision over per-doctor rates).
// Seeded with all three source types at 0 so the settings screen always has something to show
// and edit, rather than starting empty until a first save.
exports.up = async function up(knex) {
  await knex.schema.createTable('service_fees', (table) => {
    table.increments('id').primary();
    table.string('source_type', 20).notNullable().unique();
    table.decimal('doctor_fee', 10, 2).notNullable().defaultTo(0);

    table
      .integer('updated_by')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(`
    ALTER TABLE service_fees
    ADD CONSTRAINT service_fees_source_type_check
    CHECK (source_type IN ('animal_bite', 'consultation', 'manual'))
  `);
  await knex.raw(`
    ALTER TABLE service_fees
    ADD CONSTRAINT service_fees_doctor_fee_check
    CHECK (doctor_fee >= 0)
  `);

  await knex('service_fees').insert([
    { source_type: 'animal_bite', doctor_fee: 0 },
    { source_type: 'consultation', doctor_fee: 0 },
    { source_type: 'manual', doctor_fee: 0 },
  ]);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('service_fees');
};
