exports.up = function up(knex) {
  return knex.schema.createTable('user_permissions', (table) => {
    table.increments('id').primary();
    table
      .integer('user_id')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table
      .integer('permission_id')
      .notNullable()
      .references('id')
      .inTable('permissions')
      .onDelete('CASCADE');
    table.boolean('granted').notNullable(); // true = grant override, false = explicit revoke
    table
      .integer('granted_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('granted_at').notNullable().defaultTo(knex.fn.now());
    table.text('reason').notNullable();
    table.unique(['user_id', 'permission_id']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('user_permissions');
};
