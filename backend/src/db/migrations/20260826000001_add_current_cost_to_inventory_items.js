// Financial Management, Vaccine Cost Options (replaces per-batch unit_cost as the Cost of
// Goods Sold source — see the migration dropping `service_fees` for the companion change).
// A single, Management-editable "current cost" per item, separate from a batch's historical
// purchase cost (inventory_batches.unit_cost) — Management doesn't need to remember to type a
// cost in every time a shipment arrives; they set one standing figure per vaccine and update it
// whenever pricing changes.
exports.up = async function up(knex) {
  await knex.schema.alterTable('inventory_items', (table) => {
    table.decimal('current_cost', 10, 2);
  });
  await knex.raw(`
    ALTER TABLE inventory_items
    ADD CONSTRAINT inventory_items_current_cost_check
    CHECK (current_cost IS NULL OR current_cost >= 0)
  `);
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('inventory_items', (table) => {
    table.dropColumn('current_cost');
  });
};
