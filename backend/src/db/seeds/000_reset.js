// Dev-only reset so `npm run seed` is repeatable against a scratch database.
// Deletes in FK-safe order (children before parents). Never run against production data —
// this seed set is for standing up local/staging environments, not for go-live.
exports.seed = async function seed(knex) {
  await knex('user_permissions').del();
  await knex('audit_logs').del();
  await knex('users').del();
  await knex('role_permissions').del();
  await knex('permissions').del();
  await knex('roles').del();
};
