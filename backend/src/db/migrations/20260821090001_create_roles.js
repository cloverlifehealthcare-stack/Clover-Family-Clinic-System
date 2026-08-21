exports.up = function up(knex) {
  return knex.schema.createTable('roles', (table) => {
    table.increments('id').primary();
    table.string('name', 50).notNullable().unique();
    table.text('description');
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('roles');
};
