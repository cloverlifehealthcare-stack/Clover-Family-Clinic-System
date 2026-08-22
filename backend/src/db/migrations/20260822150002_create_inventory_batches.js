exports.up = async function up(knex) {
  await knex.schema.createTable('inventory_batches', (table) => {
    table.increments('id').primary();
    table
      .integer('inventory_item_id')
      .notNullable()
      .references('id')
      .inTable('inventory_items')
      .onDelete('RESTRICT');

    table.string('batch_lot_number', 100).notNullable();
    table.date('expiration_date'); // nullable — not every "supply/other" item expires
    table.integer('quantity_received').notNullable();
    table.integer('quantity_remaining').notNullable();
    table.decimal('unit_cost', 10, 2);
    table.string('supplier', 150);

    table
      .integer('received_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('received_at').notNullable().defaultTo(knex.fn.now());

    table.index(['inventory_item_id']);
    table.index(['expiration_date']);
  });

  // quantity_remaining can never exceed what was received or drop below zero. The two ways
  // it changes (dose/RIG consumption, manual adjustments) both go through
  // inventory.service.js, which enforces this at the application layer too, but a raw SQL
  // update bypassing that shouldn't be able to silently corrupt stock levels either.
  await knex.raw(`
    ALTER TABLE inventory_batches
    ADD CONSTRAINT inventory_batches_quantity_bounds CHECK (
      quantity_remaining >= 0 AND quantity_remaining <= quantity_received
    )
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('inventory_batches');
};
