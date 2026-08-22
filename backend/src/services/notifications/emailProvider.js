const env = require('../../config/env');
const stubProvider = require('./providers/stubEmailProvider');

const PROVIDERS = { stub: stubProvider };
// const PROVIDERS = { stub: stubProvider, gmail: require('./providers/gmailEmailProvider') };
// ^ uncomment once a real Gmail implementation exists, matching the same send() contract.

function getProvider() {
  return PROVIDERS[env.notifications.emailProvider] || stubProvider;
}

async function sendEmail({ to, subject, message }) {
  return getProvider().send({ to, subject, message });
}

module.exports = { sendEmail };
