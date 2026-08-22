// Runs once, in Jest's main process — NOT a test worker — before any test file. Jest's
// workers are forked from this process and inherit whatever is in its process.env at fork
// time, so this file must not mutate process.env with values from backend/.env: doing so
// (e.g. via `dotenv.config()`, which writes into process.env) would leak development
// settings like LOGIN_MAX_ATTEMPTS into every worker, silently overriding the test-specific
// values tests/env.setup.js tries to set there. dotenv.parse() reads the file without
// touching process.env, so only this script sees its values.
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

function loadDotEnvFile() {
  const envPath = path.resolve(__dirname, '../.env');
  return fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
}

module.exports = async function globalSetup() {
  const fileEnv = loadDotEnvFile();
  const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || fileEnv.TEST_DATABASE_URL || fileEnv.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set TEST_DATABASE_URL (or DATABASE_URL) before running tests.');
  }

  // Seeds read these from process.env — set them only for this standalone script's own
  // process, which exits as soon as this function returns, well before workers are forked.
  process.env.SEED_MANAGEMENT_EMAIL = process.env.SEED_MANAGEMENT_EMAIL || fileEnv.SEED_MANAGEMENT_EMAIL || 'management@test.local';
  process.env.SEED_MANAGEMENT_PASSWORD = process.env.SEED_MANAGEMENT_PASSWORD || fileEnv.SEED_MANAGEMENT_PASSWORD || 'Test-Password-123';
  process.env.SEED_MANAGEMENT_FULL_NAME = process.env.SEED_MANAGEMENT_FULL_NAME || fileEnv.SEED_MANAGEMENT_FULL_NAME || 'Test Management';

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
