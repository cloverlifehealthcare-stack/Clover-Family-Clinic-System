exports.up = function up(knex) {
  return knex.schema.createTable('audit_logs', (table) => {
    table.increments('id').primary();
    // Nullable: a failed login against an unknown email has no user_id to attach to.
    table
      .integer('user_id')
      .references('id')
      .inTable('users')
      .onDelete('SET NULL');
    table.string('action', 100).notNullable();
    table.string('entity_type', 100).notNullable();
    table.string('entity_id', 100);
    table.jsonb('old_value');
    table.jsonb('new_value');
    table.string('ip_address', 45);
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.index(['user_id']);
    table.index(['entity_type', 'entity_id']);
    table.index(['created_at']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('audit_logs');
};
