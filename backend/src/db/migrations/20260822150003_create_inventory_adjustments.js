// Manual/exceptional stock changes only (correction, spoilage, expired write-off) — routine
// consumption via dose/RIG administration is tracked through abc_treatment_doses /
// abc_rig_administrations' own inventory_batch_id link (added in the next migration), not
// logged here, to keep this an audit trail of exceptions rather than routine noise.
exports.up = async function up(knex) {
  await knex.schema.createTable('inventory_adjustments', (table) => {
    table.increments('id').primary();
    table
      .integer('inventory_batch_id')
      .notNullable()
      .references('id')
      .inTable('inventory_batches')
      .onDelete('RESTRICT');

    table.string('adjustment_type', 20).notNullable(); // correction | spoilage | expired | other
    table.integer('quantity_delta').notNullable(); // negative for reductions, positive for corrections up
    table.text('reason').notNullable();

    table
      .integer('adjusted_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('adjusted_at').notNullable().defaultTo(knex.fn.now());

    table.index(['inventory_batch_id']);
  });

  await knex.raw(`
    ALTER TABLE inventory_adjustments
    ADD CONSTRAINT inventory_adjustments_type_check
    CHECK (adjustment_type IN ('correction', 'spoilage', 'expired', 'other'))
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('inventory_adjustments');
};
