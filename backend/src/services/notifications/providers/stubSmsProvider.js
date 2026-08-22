// Stub SMS provider — logs instead of actually sending. Swap in a real Globe SMS API client
// once credentials/sender-ID registration exist (docs/clover-architecture.md §0: Globe
// confirmed as the SMS channel). A real provider would POST to Globe's business messaging
// API using credentials from environment variables, but must keep this exact
// {to, message} -> {success, providerResponse} contract so reminders.service.js never has
// to change — only src/config/env.js's SMS_PROVIDER switch and this file's sibling would.
async function send({ to, message }) {
  const providerResponse = `STUB: would send SMS via Globe to ${to}: "${message}"`;
  console.log(providerResponse); // eslint-disable-line no-console
  return { success: true, providerResponse };
}

module.exports = { send };
