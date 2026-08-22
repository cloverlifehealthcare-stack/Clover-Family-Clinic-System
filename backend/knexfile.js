require('dotenv').config();

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  // Falls back to POSTGRES_URL — see the matching comment in src/config/env.js for why.
  connection: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
  pool: { min: 2, max: 10 },
};
