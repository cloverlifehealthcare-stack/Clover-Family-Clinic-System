const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');

const authRoutes = require('./modules/auth/auth.routes');
const usersRoutes = require('./modules/users/users.routes');
const permissionsRoutes = require('./modules/permissions/permissions.routes');
const patientsRoutes = require('./modules/patients/patients.routes');
const animalBiteRoutes = require('./modules/animal-bite/animalBite.routes');
const consultationsRoutes = require('./modules/consultations/consultations.routes');
const appointmentsRoutes = require('./modules/appointments/appointments.routes');
const servicesRoutes = require('./modules/services/services.routes');
const billingRoutes = require('./modules/billing/billing.routes');
const inventoryRoutes = require('./modules/inventory/inventory.routes');
const schedulingRoutes = require('./modules/scheduling/scheduling.routes');
const remindersRoutes = require('./modules/reminders/reminders.routes');
const financialRoutes = require('./modules/financial/financial.routes');
const reportsRoutes = require('./modules/reports/reports.routes');
const auditRoutes = require('./modules/audit/audit.routes');
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
// Mixes /api/animal-bite-records/* and /api/patients/:patientId/animal-bite-records —
// mounted at /api rather than a single fixed prefix (see animalBite.routes.js).
app.use('/api', animalBiteRoutes);
app.use('/api', consultationsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/services', servicesRoutes);
// Mixes /api/billing/* and /api/patients/:patientId/billing-statements — mounted at /api
// rather than a single fixed prefix (see billing.routes.js).
app.use('/api', billingRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/scheduling', schedulingRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/financial', financialRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/audit-logs', auditRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
