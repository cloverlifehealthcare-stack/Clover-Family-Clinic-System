const jwt = require('jsonwebtoken');
const env = require('../config/env');

// Mirrors src/services/token.service.js exactly, but signed with env.patientJwt's separate
// secrets and carrying a `type: 'patient'` claim — belt-and-suspenders on top of the secret
// separation itself, so a decoded token is also self-evidently not a staff token.
function signAccessToken(account) {
  return jwt.sign({ sub: account.id, type: 'patient' }, env.patientJwt.accessSecret, { expiresIn: env.patientJwt.accessExpiresIn });
}

function signRefreshToken(account) {
  return jwt.sign(
    { sub: account.id, tokenVersion: account.tokenVersion, type: 'patient' },
    env.patientJwt.refreshSecret,
    { expiresIn: env.patientJwt.refreshExpiresIn }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.patientJwt.accessSecret);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.patientJwt.refreshSecret);
}

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken };
