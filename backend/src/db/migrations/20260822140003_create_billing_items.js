exports.up = function up(knex) {
  return knex.schema.createTable('billing_items', (table) => {
    table.increments('id').primary();
    table
      .integer('billing_statement_id')
      .notNullable()
      .references('id')
      .inTable('billing_statements')
      .onDelete('CASCADE');
    table
      .integer('service_id') // nullable — allows a manual line item, per §4.2
      .references('id')
      .inTable('services')
      .onDelete('SET NULL');

    table.string('description', 255).notNullable();
    table.integer('quantity').notNullable().defaultTo(1);
    table.decimal('unit_price', 10, 2).notNullable();
    table.boolean('is_discount_eligible').notNullable().defaultTo(true);
    table.decimal('amount', 10, 2).notNullable(); // quantity * unit_price, computed at creation
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('billing_items');
};
