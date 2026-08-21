// Columns beyond docs/clover-architecture.md §4.2 (token_version, failed_login_attempts,
// locked_until) are auth-mechanics internals needed to implement the §1.4 security baseline
// (revocable refresh tokens, failed-login lockout) — not domain fields, so not listed there.
exports.up = function up(knex) {
  return knex.schema.createTable('users', (table) => {
    table.increments('id').primary();
    table
      .integer('role_id')
      .notNullable()
      .references('id')
      .inTable('roles')
      .onDelete('RESTRICT');
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.string('full_name', 150).notNullable();
    table.string('contact_number', 30);
    table.boolean('is_active').notNullable().defaultTo(true);
    table.integer('token_version').notNullable().defaultTo(0);
    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until');
    table.timestamp('last_login_at');
    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('users');
};
