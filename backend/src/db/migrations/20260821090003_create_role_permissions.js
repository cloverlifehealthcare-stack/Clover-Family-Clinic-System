exports.up = function up(knex) {
  return knex.schema.createTable('role_permissions', (table) => {
    table.increments('id').primary();
    table
      .integer('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('CASCADE');
    table
      .integer('permission_id')
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    table.timestamps(true, true);
    table.unique(['role_id', 'permission_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('role_permissions');
};
