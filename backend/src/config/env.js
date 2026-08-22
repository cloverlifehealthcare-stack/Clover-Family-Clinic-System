require('dotenv').config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 4000,
  // Falls back to POSTGRES_URL — the name Vercel's database integrations (Supabase, Neon,
  // etc.) use automatically once a database is connected to a project. Those variables are
  // marked "Sensitive" in the Vercel dashboard and can't be viewed/copied again after being
  // set, so accepting the name Vercel already provides avoids ever needing to copy the value
  // into a separately-named DATABASE_URL by hand.
  databaseUrl: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  // Separate secrets from staff JWTs (not just a different `role` claim) — a leaked staff
  // secret must not be able to forge a patient session, or vice versa. Phase 4 Patient Portal,
  // docs/clover-architecture.md §1.3's "different auth flow, different security posture."
  patientJwt: {
    accessSecret: process.env.PATIENT_JWT_ACCESS_SECRET,
    refreshSecret: process.env.PATIENT_JWT_REFRESH_SECRET,
    accessExpiresIn: process.env.PATIENT_JWT_ACCESS_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.PATIENT_JWT_REFRESH_EXPIRES_IN || '7d',
  },
  login: {
    maxAttempts: parseInt(process.env.LOGIN_MAX_ATTEMPTS, 10) || 5,
    lockoutMinutes: parseInt(process.env.LOGIN_LOCKOUT_MINUTES, 10) || 15,
  },
  // Shared secret for Vercel Cron's daily call to GET /api/reminders/cron — that endpoint has
  // no staff login to check (a cron trigger isn't a logged-in user), so it's gated by this
  // instead. See middleware/cronAuth.middleware.js.
  cronSecret: process.env.CRON_SECRET,
  // Comma-separated list of allowed origins for the two frontends (staff SPA + patient
  // portal). Defaults cover local dev (frontend on 5173, patient-portal on 5174) plus the
  // two Vercel URLs from this project's first deploy — override via CORS_ORIGINS once a
  // custom domain replaces either .vercel.app URL, rather than editing code.
  corsOrigins: (
    process.env.CORS_ORIGINS ||
    'http://localhost:5173,http://localhost:5174,https://clover-family-clinic-system-1sc7.vercel.app,https://clover-family-clinic-system-n6k2.vercel.app'
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // docs/clover-architecture.md §0: Globe (SMS) and Gmail (email) are the confirmed channels;
  // real credentials don't exist yet, so both default to 'stub' (logs instead of sending —
  // see src/services/notifications/). Switch to 'globe'/'gmail' once real API
  // credentials/sender-ID registration exist, without changing any calling code.
  notifications: {
    smsProvider: process.env.SMS_PROVIDER || 'stub',
    emailProvider: process.env.EMAIL_PROVIDER || 'stub',
    clinicContactNumber: process.env.CLINIC_CONTACT_NUMBER || '+63 955 437 4779',
    clinicContactEmail: process.env.CLINIC_CONTACT_EMAIL || 'cloverfamilycareabc@gmail.com',
  },
  required,
};
