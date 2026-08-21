exports.up = function up(knex) {
  return knex.schema.createTable('permissions', (table) => {
    table.increments('id').primary();
    table.string('code', 100).notNullable().unique();
    table.string('module', 50).notNullable();
    table.text('description').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('permissions');
};
