// Phase 4, Patient Portal (docs/clover-architecture.md §2/§1.3: "deliberately a separate
// frontend app... different auth flow, different security posture"). patient_accounts is a
// completely separate credentials table from staff `users` — a portal login and a staff login
// are different security domains by design, not just different roles in the same table. 1:1
// with `patients` (one portal account per clinical record) via the unique FK. Mirrors the
// auth-relevant columns on `users` (failed_login_attempts/locked_until/token_version) so the
// same lockout + rotating-refresh-token logic pattern applies here too.
//
// v1 scope (see AskUserQuestion decision in the PR this shipped in): adults only. A minor has
// no portal account — self-registration is rejected in the service layer for anyone under 18,
// enforced there rather than as a DB constraint since it depends on the linked patient's
// date_of_birth, which can change (a birthday) independent of this row.
exports.up = async function up(knex) {
  await knex.schema.createTable('patient_accounts', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('patients')
      .onDelete('CASCADE');

    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.boolean('is_active').notNullable().defaultTo(true);

    table.integer('failed_login_attempts').notNullable().defaultTo(0);
    table.timestamp('locked_until');
    table.integer('token_version').notNullable().defaultTo(0);
    table.timestamp('last_login_at');

    table.timestamps(true, true);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('patient_accounts');
};
