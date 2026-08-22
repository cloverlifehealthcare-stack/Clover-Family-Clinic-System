require('dotenv').config();

// Falls back to POSTGRES_URL — see the matching comment in src/config/env.js for why.
const rawConnectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';

// Local Postgres (docker-compose, no TLS at all) vs. a hosted provider (Supabase/Neon/etc.,
// which terminates TLS at a pooler presenting a cert chain Node's default CA bundle doesn't
// trust). Two things were needed to actually fix the "self-signed certificate in certificate
// chain" error connecting to Supabase's pooler, not just one:
//   1. An explicit ssl object below, with rejectUnauthorized: false.
//   2. Stripping `sslmode` out of the URL itself — pg-connection-string parses that query
//      param and treats 'require' (and 'prefer'/'verify-ca') as an alias for 'verify-full',
//      which silently overrides the explicit ssl object above and re-enables full chain
//      verification regardless of what's passed in code.
const isLocalDb = /localhost|127\.0\.0\.1/.test(rawConnectionString);
const connectionString = rawConnectionString.replace(/([?&])sslmode=[^&]*&?/, '$1').replace(/[?&]$/, '');

/** @type {import('knex').Knex.Config} */
module.exports = {
  client: 'pg',
  connection: {
    connectionString,
    ssl: isLocalDb ? false : { rejectUnauthorized: false },
  },
  migrations: {
    directory: './src/db/migrations',
    tableName: 'knex_migrations',
  },
  seeds: {
    directory: './src/db/seeds',
  },
  pool: { min: 2, max: 10 },
};
