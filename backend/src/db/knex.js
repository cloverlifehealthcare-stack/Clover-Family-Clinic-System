const { types } = require('pg');
const knex = require('knex');
const knexConfig = require('../../knexfile');

// Without this, node-postgres parses DATE columns (e.g. patients.date_of_birth) into JS Date
// objects at local midnight, which then serialize to JSON in UTC — shifting the date backward
// by a day for any timezone ahead of UTC (including the Philippines, UTC+8). Returning the raw
// 'YYYY-MM-DD' string instead sidesteps timezone conversion entirely. OID 1082 = Postgres DATE.
types.setTypeParser(1082, (value) => value);

module.exports = knex(knexConfig);
