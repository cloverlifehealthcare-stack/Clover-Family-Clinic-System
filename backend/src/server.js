const app = require('./app');
const env = require('./config/env');

if (!env.databaseUrl) {
  throw new Error('Missing required environment variable: DATABASE_URL (or POSTGRES_URL)');
}
env.required('JWT_ACCESS_SECRET');
env.required('JWT_REFRESH_SECRET');

app.listen(env.port, () => {
  console.log(`Clover Clinic API listening on port ${env.port} (${env.nodeEnv})`); // eslint-disable-line no-console
});
