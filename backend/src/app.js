const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const permissionsRoutes = require('./modules/permissions/permissions.routes');
const patientsRoutes = require('./modules/patients/patients.routes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();

// Hosting proposal (docs/clover-architecture.md §1.3) puts Nginx/a CDN in front of the API,
// so req.ip must come from X-Forwarded-For or every audit_logs.ip_address row records the
// proxy's address instead of the real client's.
if (env.nodeEnv === 'production') {
  app.set('trust proxy', 1);
}

app.use(helmet());
app.use(cors());
app.use(express.json());
if (env.nodeEnv !== 'test') {
  app.use(morgan(env.nodeEnv === 'development' ? 'dev' : 'combined'));
}

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/permissions', permissionsRoutes);
app.use('/api/patients', patientsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
