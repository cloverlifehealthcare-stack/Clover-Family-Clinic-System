// docs/clover-architecture.md §4.2 `abc_treatment_doses` — Day 0/3/7/14/28 rabies PEP schedule.
exports.up = function up(knex) {
  return knex.schema.createTable('abc_treatment_doses', (table) => {
    table.increments('id').primary();
    table
      .integer('animal_bite_record_id')
      .notNullable()
      .references('id')
      .inTable('animal_bite_records')
      .onDelete('CASCADE');

    table.integer('dose_number').notNullable();
    table.string('vaccine_name', 150).notNullable();
    table.string('batch_lot_number', 100); // free text in Phase 1; FK to Inventory in Phase 2
    table.string('dose_amount', 50);
    table.string('anatomical_site', 100);

    table
      .integer('administered_by')
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('administered_at');
    table.date('scheduled_date');
    table.string('status', 20).notNullable().defaultTo('scheduled'); // scheduled/administered/missed

    table.unique(['animal_bite_record_id', 'dose_number']);
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('abc_treatment_doses');
};
