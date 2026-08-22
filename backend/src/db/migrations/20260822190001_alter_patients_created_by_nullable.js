// Phase 4, Patient Portal self-registration (docs/clover-architecture.md §2). A self-registered
// patient has no staff `users` row to attribute the record to — `created_by` becomes nullable,
// with NULL meaning "created via patient self-registration" rather than by a staff member.
exports.up = function up(knex) {
  return knex.raw('ALTER TABLE patients ALTER COLUMN created_by DROP NOT NULL');
};

exports.down = function down(knex) {
  return knex.raw('ALTER TABLE patients ALTER COLUMN created_by SET NOT NULL');
};
