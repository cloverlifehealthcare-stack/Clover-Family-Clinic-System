// Financial Management, Cash Disbursement (post-launch addition, at the clinic's request): a
// "Particulars" category — Doctor's Daily Fee or Other — alongside the existing free-text
// `particulars` column, which now serves as the specific reason/detail for that disbursement
// (e.g. "Dr. Santos, 8 hrs" or "Office supplies restock"). Mirrors the category/description split
// already used on `expenses`.
exports.up = async function up(knex) {
  await knex.schema.alterTable('cash_disbursements', (table) => {
    table.string('category', 20).notNullable().defaultTo('other');
  });
  await knex.raw(`
    ALTER TABLE cash_disbursements
    ADD CONSTRAINT cash_disbursements_category_check
    CHECK (category IN ('doctors_fee', 'other'))
  `);
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('cash_disbursements', (table) => {
    table.dropColumn('category');
  });
};
