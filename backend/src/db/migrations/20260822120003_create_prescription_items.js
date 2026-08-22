exports.up = function up(knex) {
  return knex.schema.createTable('prescription_items', (table) => {
    table.increments('id').primary();
    table
      .integer('prescription_id')
      .notNullable()
      .references('id')
      .inTable('prescriptions')
      .onDelete('CASCADE');
    table.string('medicine_name', 200).notNullable();
    table.string('dosage', 100).notNullable();
    table.text('instructions');
    table.string('quantity', 50);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('prescription_items');
};
