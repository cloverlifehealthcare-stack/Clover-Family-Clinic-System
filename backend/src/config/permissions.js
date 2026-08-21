// Master permission catalog. Codes for modules not yet built (animal bite, consultation,
// billing, ...) are seeded now against docs/clover-architecture.md §3.2 so later modules
// only need to add `requirePermission('code')` to a route — the RBAC framework and role
// defaults already exist. Row-level rules (e.g. "own patients only", "own actions only")
// are enforced in each module's service layer, not encoded as separate permission codes —
// see docs/clover-architecture.md §5.4.

const PERMISSIONS = [
  { code: 'users.manage', module: 'auth', description: 'Create, update, and deactivate staff user accounts' },

  { code: 'patients.create', module: 'patients', description: 'Register a new patient' },
  { code: 'patients.edit', module: 'patients', description: "Edit an existing patient's demographics" },
  { code: 'patients.view', module: 'patients', description: 'Search and view the patient list' },
  { code: 'patients.history.view', module: 'patients', description: "View a patient's full medical history" },

  { code: 'animalbite.assessment.create', module: 'animal_bite', description: 'Enter initial assessment & vitals for an animal bite visit' },
  { code: 'animalbite.diagnosis.record', module: 'animal_bite', description: "Record the doctor's exposure classification and treatment decision" },
  { code: 'animalbite.treatment.administer', module: 'animal_bite', description: 'Record vaccine or RIG dose administration' },

  { code: 'consultation.assessment.create', module: 'consultation', description: 'Enter initial assessment & vitals for a consultation' },
  { code: 'consultation.diagnosis.record', module: 'consultation', description: "Record the doctor's diagnosis and treatment notes" },

  { code: 'prescription.issue', module: 'consultation', description: 'Issue / print a prescription' },
  { code: 'education.record', module: 'shared', description: 'Record patient education given' },

  { code: 'appointments.manage', module: 'appointments', description: 'Create, reschedule, and cancel appointments' },
  { code: 'appointments.view', module: 'appointments', description: 'View the appointment schedule' },

  { code: 'billing.create', module: 'billing', description: 'Create billing statements / charges' },
  { code: 'billing.view', module: 'billing', description: 'View billing / payment history' },
  { code: 'payment.process', module: 'billing', description: 'Process a payment and issue a receipt' },
  { code: 'payment.void', module: 'billing', description: 'Void or reverse a payment' },
  { code: 'financial.view', module: 'billing', description: 'View profit / expense / financial reports' },

  { code: 'audit.view', module: 'audit', description: 'View audit log entries' },
];

module.exports = { PERMISSIONS };
