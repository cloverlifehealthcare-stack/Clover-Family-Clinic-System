// docs/clover-architecture.md §4.2 `abc_rig_administrations` — WHO Category III only, given
// once (unique on animal_bite_record_id enforces that at the database level).
exports.up = function up(knex) {
  return knex.schema.createTable('abc_rig_administrations', (table) => {
    table.increments('id').primary();
    table
      .integer('animal_bite_record_id')
      .notNullable()
      .unique()
      .references('id')
      .inTable('animal_bite_records')
      .onDelete('CASCADE');

    table.string('rig_product_name', 150).notNullable();
    table.string('batch_lot_number', 100);
    table.decimal('patient_weight_kg', 5, 2).notNullable();
    table.string('calculated_dose', 50).notNullable();
    table.string('site_infiltrated_amount', 50);
    table.string('im_injected_amount', 50);

    table
      .integer('administered_by')
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('RESTRICT');
    table.timestamp('administered_at').notNullable().defaultTo(knex.fn.now());
  });
};

exports.down = function down(knex) {
  return knex.schema.dropTableIfExists('abc_rig_administrations');
};
