// Runs once, in a separate process from the test workers, before any test file. Points a
// standalone knex instance at TEST_DATABASE_URL and brings it to a known state (migrate,
// then seed) so every test run starts from the same fixture data.
//
// Requires a real, disposable Postgres database — see backend/README.md. Never point
// TEST_DATABASE_URL at anything you care about; the seed's 000_reset wipes RBAC/user tables.
require('dotenv').config();

module.exports = async function globalSetup() {
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) before running tests.');
  }

  process.env.SEED_MANAGEMENT_EMAIL = process.env.SEED_MANAGEMENT_EMAIL || 'management@test.local';
  process.env.SEED_MANAGEMENT_PASSWORD = process.env.SEED_MANAGEMENT_PASSWORD || 'Test-Password-123';
  process.env.SEED_MANAGEMENT_FULL_NAME = process.env.SEED_MANAGEMENT_FULL_NAME || 'Test Management';

  const knex = require('knex')({
    client: 'pg',
    connection: databaseUrl,
    migrations: { directory: './src/db/migrations' },
    seeds: { directory: './src/db/seeds' },
  });

  await knex.migrate.latest();
  await knex.seed.run();
  await knex.destroy();
};
