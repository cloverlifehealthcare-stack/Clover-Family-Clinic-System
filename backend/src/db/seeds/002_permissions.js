const { PERMISSIONS } = require('../../config/permissions');

exports.seed = async function seed(knex) {
  await knex('permissions').insert(PERMISSIONS);
};
