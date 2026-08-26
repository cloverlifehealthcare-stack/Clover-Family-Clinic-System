// Removed at the clinic's explicit correction: doctors are actually paid a variable daily
// amount based on hours worked or patients seen, not a fixed rate per doctor or per visit, so
// there was no accurate figure this table could hold. Doctor's fee payments are now tracked as
// Cash Disbursement entries instead (see 20260825220001_create_cash_disbursements.js) — already
// netted against clinic-wide Net Profit, just not attributed to one specific patient visit.
exports.up = function up(knex) {
  return knex.schema.dropTableIfExists('doctor_fees');
};

exports.down = async function down(knex) {
  await knex.schema.createTable('doctor_fees', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
    table.decimal('fee_amount', 10, 2).notNullable().defaultTo(0);
    table.integer('updated_by').references('id').inTable('users').onDelete('SET NULL');
    table.timestamp('updated_at').notNullable().defaultTo(knex.fn.now());
  });
  await knex.raw(`
    ALTER TABLE doctor_fees
    ADD CONSTRAINT doctor_fees_fee_amount_check
    CHECK (fee_amount >= 0)
  `);
};
