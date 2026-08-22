// Same reasoning as the patients migration in this batch: a patient booking their own
// appointment through the portal has no staff `users` row to attribute it to. NULL means
// "booked by the patient themselves," not by staff.
exports.up = function up(knex) {
  return knex.raw('ALTER TABLE appointments ALTER COLUMN created_by DROP NOT NULL');
};

exports.down = function down(knex) {
  return knex.raw('ALTER TABLE appointments ALTER COLUMN created_by SET NOT NULL');
};
