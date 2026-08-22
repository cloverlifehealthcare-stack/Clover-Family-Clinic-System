const env = require('../../config/env');
const stubProvider = require('./providers/stubSmsProvider');

const PROVIDERS = { stub: stubProvider };
// const PROVIDERS = { stub: stubProvider, globe: require('./providers/globeSmsProvider') };
// ^ uncomment once a real Globe implementation exists, matching the same send() contract.

function getProvider() {
  return PROVIDERS[env.notifications.smsProvider] || stubProvider;
}

async function sendSms({ to, message }) {
  return getProvider().send({ to, message });
}

module.exports = { sendSms };
