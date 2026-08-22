// Runs before test modules are loaded in each worker, so src/db/knex.js (which reads
// DATABASE_URL at require-time) connects to the test database, never a real one.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
// Forced, not defaulted: tests/auth.test.js asserts against this exact number, so it must
// never silently inherit whatever LOGIN_MAX_ATTEMPTS happens to be set to elsewhere (e.g.
// backend/.env's development value) via process env inheritance from Jest's main process.
process.env.LOGIN_MAX_ATTEMPTS = '3';
process.env.LOGIN_LOCKOUT_MINUTES = '15';
process.env.SEED_MANAGEMENT_EMAIL = process.env.SEED_MANAGEMENT_EMAIL || 'management@test.local';
process.env.SEED_MANAGEMENT_PASSWORD = process.env.SEED_MANAGEMENT_PASSWORD || 'Test-Password-123';
process.env.SEED_MANAGEMENT_FULL_NAME = process.env.SEED_MANAGEMENT_FULL_NAME || 'Test Management';
