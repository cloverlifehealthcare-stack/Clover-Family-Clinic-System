// Replaced by per-vaccine cost (inventory_items.current_cost) + per-doctor fee (doctor_fees) —
// see 20260826000001/20260826000002. The flat per-source-type default this table held wasn't
// accurate enough (same fee regardless of which doctor performed the service, or which vaccine
// was actually used), so it's removed rather than left dormant alongside its replacement.
exports.up = function up(knex) {
  return knex.schema.dropTableIfExists('service_fees');
};

exports.down = async function down(knex) {
  await knex.schema.createTable('service_fees', (table) => {
    table.increments('id').primary();
    table.string('source_type', 20).notNullable().unique();
    table.decimal('doctor_fee', 10, 2).notNullable().defaultTo(0);
    table.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
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
