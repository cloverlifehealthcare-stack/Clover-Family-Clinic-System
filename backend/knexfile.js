require('dotenv').config();

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection: process.env.DATABASE_URL,
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
  pool: { min: 2, max: 10 },
};
