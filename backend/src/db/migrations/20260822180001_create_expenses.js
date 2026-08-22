// Phase 3, Financial Management (docs/clover-architecture.md §2, "Financial Management
// (sales/expense/profit, Sales Journal, Sales Ledger)"). Sales figures are derived from the
// existing `payments`/`billing_statements` tables rather than duplicated here — this table
// only holds the other half (expenses) needed to compute profit. Void pattern (status/
// void_reason/voided_by/voided_at) mirrors `payments` — no hard delete, for the same audit
// reasons.
exports.up = async function up(knex) {
  await knex.schema.createTable('expenses', (table) => {
    table.increments('id').primary();
    table.date('expense_date').notNullable();
    table.string('category', 30).notNullable();
    table.string('description', 255).notNullable();
    table.decimal('amount', 10, 2).notNullable();
    table.string('paid_to', 150);

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

    table.index(['expense_date']);
  });

  await knex.raw(`
    ALTER TABLE expenses
    ADD CONSTRAINT expenses_category_check
    CHECK (category IN ('supplies', 'utilities', 'rent', 'salaries', 'equipment', 'maintenance', 'other'))
  `);
  await knex.raw(`
    ALTER TABLE expenses
    ADD CONSTRAINT expenses_status_check
    CHECK (status IN ('active', 'voided'))
  `);
  await knex.raw(`
    ALTER TABLE expenses
    ADD CONSTRAINT expenses_amount_check
    CHECK (amount > 0)
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('expenses');
};
