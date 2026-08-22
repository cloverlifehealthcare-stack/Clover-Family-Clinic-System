// Phase 2. docs/clover-architecture.md §2 lists "Inventory (stock, batches, expiration,
// reorder alerts)" as a Phase 2 module without a detailed schema — this table design is a
// reasonable extrapolation, not a transcribed spec, since none exists yet for Phase 2.
exports.up = function up(knex) {
  return knex.schema.createTable('inventory_items', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('category', 30).notNullable(); // vaccine | rig | medicine | supply | other
    table.string('unit', 30).notNullable(); // vial, dose, box, piece, ...
    table.integer('reorder_threshold').notNullable().defaultTo(0);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('inventory_items');
};
