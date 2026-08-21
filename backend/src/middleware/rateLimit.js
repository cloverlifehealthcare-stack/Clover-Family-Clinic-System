const rateLimit = require('express-rate-limit');

// Coarse network-level throttle on the login endpoint, on top of (not instead of) the
// per-account lockout in auth.service — this limits brute-force sweeps across many
// accounts from one source; the lockout limits guessing against one account.
const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts from this network. Try again later.' },
});

module.exports = { loginRateLimiter };
