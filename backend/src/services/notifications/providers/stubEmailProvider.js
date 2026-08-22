// Stub email provider — logs instead of actually sending. Swap in a real Gmail SMTP client
// (e.g. nodemailer against smtp.gmail.com with an app password, or the Gmail API) once
// credentials exist. Same {to, subject, message} -> {success, providerResponse} contract as
// the real implementation would use, so reminders.service.js doesn't change either way.
async function send({ to, subject, message }) {
  const providerResponse = `STUB: would send email via Gmail to ${to}, subject "${subject}": "${message}"`;
  console.log(providerResponse); // eslint-disable-line no-console
  return { success: true, providerResponse };
}

module.exports = { send };
