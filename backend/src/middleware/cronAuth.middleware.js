const crypto = require('crypto');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');

/**
 * Gates a route meant to be called by Vercel Cron, not a logged-in staff member — there's no
 * JWT to check here. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron
 * invocations when that env var is set, per Vercel's own convention for securing cron
 * endpoints, so this middleware just verifies that header matches. Uses a timing-safe
 * comparison so response time can't leak how much of the secret a guess got right.
 */
const requireCronSecret = asyncHandler(async (req, res, next) => {
  if (!env.cronSecret) {
    throw new ApiError(500, 'CRON_SECRET is not configured.');
  }

  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'Missing or malformed Authorization header.');
  }

  const tokenBuffer = Buffer.from(token);
  const secretBuffer = Buffer.from(env.cronSecret);
  const isValid = tokenBuffer.length === secretBuffer.length && crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isValid) {
    throw new ApiError(401, 'Invalid cron secret.');
  }

  next();
});

module.exports = { requireCronSecret };
