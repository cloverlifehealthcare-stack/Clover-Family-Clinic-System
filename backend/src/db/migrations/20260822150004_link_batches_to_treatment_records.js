// Fulfills the upgrade path already noted in the Phase 1 migrations' own comments:
// "batch_lot_number: free text in Phase 1; FK to Inventory in Phase 2". Nullable and
// additive — the free-text batch_lot_number column stays as-is (still required, still the
// text actually printed on the dose/RIG record), so existing Phase 1 rows and any future
// entry that doesn't reference a tracked inventory batch keep working unchanged. When this
// FK is set, animalBite.service.js decrements the batch's quantity_remaining.
exports.up = async function up(knex) {
  await knex.schema.alterTable('abc_treatment_doses', (table) => {
    table
      .integer('inventory_batch_id')
      .references('id')
      .inTable('inventory_batches')
      .onDelete('SET NULL');
  });
  await knex.schema.alterTable('abc_rig_administrations', (table) => {
    table
      .integer('inventory_batch_id')
      .references('id')
      .inTable('inventory_batches')
      .onDelete('SET NULL');
  });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('abc_treatment_doses', (table) => {
    table.dropColumn('inventory_batch_id');
  });
  await knex.schema.alterTable('abc_rig_administrations', (table) => {
    table.dropColumn('inventory_batch_id');
  });
};
