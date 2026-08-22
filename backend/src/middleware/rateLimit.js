const rateLimit = require('express-rate-limit');
const env = require('../config/env');

// Never counts requests in tests — each test FILE gets a fresh Express app (and so a fresh
// in-memory limiter store), so a single file that legitimately exercises an endpoint more
// times than the real-world limit allows (patientPortal.test.js registers ~15 accounts, well
// past the 10/hour production cap on registration) would otherwise fail on request volume
// alone, nothing to do with the actual behavior under test. Same reasoning morgan logging
// already uses one line up in app.js: a test-only carve-out, not a change to the real policy.
const skipInTest = () => env.nodeEnv === 'test';

// Coarse network-level throttle on the login endpoint, on top of (not instead of) the
// per-account lockout in auth.service — this limits brute-force sweeps across many
// accounts from one source; the lockout limits guessing against one account.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many login attempts from this network. Try again later.' },
});

// Separate instances from loginRateLimiter (not reused) so patient-portal traffic from a
// shared network (e.g. the clinic's own waiting-room wifi) can't exhaust the same budget staff
// logins depend on, and vice versa.
const patientLoginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many login attempts from this network. Try again later.' },
});

// Tighter than login — registration is the higher-abuse-risk endpoint (public-facing, no
// existing account to rate-limit against yet, each success creates a real patient record).
const patientRegisterRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  message: { error: 'Too many registration attempts from this network. Try again later.' },
});

module.exports = { loginRateLimiter, patientLoginRateLimiter, patientRegisterRateLimiter };
