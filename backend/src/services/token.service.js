const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Access tokens carry role + user ID only — no PII — per docs/clover-architecture.md §1.4.
function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.roleName },
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn }
  );
}

// Refresh tokens carry a token_version so revoking all of a user's sessions (e.g. on
// deactivation, or a suspected compromise) is one `users.token_version` increment.
function signRefreshToken(user) {
  return jwt.sign(
    { sub: user.id, tokenVersion: user.tokenVersion },
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
