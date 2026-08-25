// Financial Management, Cash Disbursement (post-launch addition, at the clinic's request): a
// record of cash paid out — separate from Expenses, which is categorized operating cost. Void
// pattern (status/void_reason/voided_by/voided_at) mirrors `expenses`/`payments` — no hard
// delete, for the same audit reasons.
exports.up = async function up(knex) {
  await knex.schema.createTable('cash_disbursements', (table) => {
    table.increments('id').primary();
    table.date('disbursement_date').notNullable();
    table.string('particulars', 255).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('given_to', 150).notNullable();

    table
      .integer('recorded_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table.string('status', 20).notNullable().defaultTo('active'); // active | voided
    table.text('void_reason');
    table
      .integer('voided_by')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('voided_at');

    table.index(['disbursement_date']);
  });

  await knex.raw(`
    ALTER TABLE cash_disbursements
    ADD CONSTRAINT cash_disbursements_status_check
    CHECK (status IN ('active', 'voided'))
  `);
  await knex.raw(`
    ALTER TABLE cash_disbursements
    ADD CONSTRAINT cash_disbursements_amount_check
    CHECK (amount > 0)
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('cash_disbursements');
};
