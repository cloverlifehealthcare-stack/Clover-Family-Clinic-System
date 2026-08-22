// docs/clover-architecture.md §4.2 `services` — a lookup table billing_items can price from.
exports.up = function up(knex) {
  return knex.schema.createTable('services', (table) => {
    table.increments('id').primary();
    table.string('name', 150).notNullable();
    table.string('category', 30).notNullable(); // consultation | animal_bite | vaccination | other
    table.decimal('default_price', 10, 2).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('services');
};
