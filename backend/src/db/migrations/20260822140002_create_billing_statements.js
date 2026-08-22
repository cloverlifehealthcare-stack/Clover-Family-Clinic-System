// docs/clover-architecture.md §4.2 `billing_statements`. source_type follows the same
// polymorphic pattern as patient_education_logs/follow_ups, plus 'manual' — a charge not
// tied to a specific clinical record (e.g. a document/certificate fee) — which those two
// tables don't need since education/follow-ups are always visit-attached.
exports.up = async function up(knex) {
  await knex.schema.createTable('billing_statements', (table) => {
    table.increments('id').primary();
    table
      .integer('patient_id')
      .notNullable()
      .references('id')
      .inTable('patients')
      .onDelete('RESTRICT');

    table.string('source_type', 20).notNullable(); // animal_bite | consultation | manual
    table.integer('source_id'); // nullable — not applicable when source_type = 'manual'

    table.string('status', 20).notNullable().defaultTo('unpaid'); // unpaid/partially_paid/paid/void
    table.decimal('subtotal_amount', 10, 2).notNullable();
    table.string('discount_type', 10).notNullable().defaultTo('none'); // none | pwd | senior
    table.string('discount_id_number', 50);
    table.string('discount_holder_name', 150);
    table.decimal('discount_amount', 10, 2).notNullable().defaultTo(0);
    table.decimal('total_amount', 10, 2).notNullable();

    table
      .integer('created_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('created_at').notNullable().defaultTo(knex.fn.now());

    table
      .integer('voided_by')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.text('void_reason');
    table.timestamp('voided_at');

    table.index(['patient_id']);
    table.index(['source_type', 'source_id']);
  });

  await knex.raw(`
    ALTER TABLE billing_statements
    ADD CONSTRAINT billing_statements_discount_type_check
    CHECK (discount_type IN ('none', 'pwd', 'senior'))
  `);
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('billing_statements');
};
