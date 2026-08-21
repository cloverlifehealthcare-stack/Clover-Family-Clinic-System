module.exports = async function globalTeardown() {
  // Test database is left in place intentionally (cheap to re-migrate/seed, and useful
  // to inspect after a failing run). Drop/recreate it yourself between runs if you want
  // a fully clean slate.
};
