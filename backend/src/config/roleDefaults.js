// Role -> default permission codes, transcribed directly from the matrix in
// docs/clover-architecture.md §3.2. Keep this file and that table in sync.

const ROLE_DEFAULTS = {
  Management: [
    'users.manage',
    'patients.create', 'patients.edit', 'patients.view', 'patients.history.view',
    'animalbite.assessment.create', 'animalbite.diagnosis.record', 'animalbite.treatment.administer',
    'consultation.assessment.create', 'consultation.diagnosis.record',
    'prescription.issue', 'education.record',
    'appointments.manage', 'appointments.view',
    'billing.create', 'billing.view', 'payment.process', 'payment.void', 'financial.view',
    'audit.view',
    'inventory.view', 'inventory.adjust',
    'scheduling.view', 'scheduling.manage',
  ],
  Admin: [
    'patients.create', 'patients.view', 'patients.history.view',
    'appointments.manage', 'appointments.view',
    'billing.create', 'billing.view', 'payment.process', 'payment.void',
    'audit.view', // row-scoped to own actions only, enforced in the audit module's service layer
    'inventory.view', 'inventory.adjust',
    'scheduling.view', 'scheduling.manage',
  ],
  Doctor: [
    'patients.view', 'patients.history.view',
    'animalbite.assessment.create', 'animalbite.diagnosis.record', 'animalbite.treatment.administer',
    'consultation.assessment.create', 'consultation.diagnosis.record',
    'prescription.issue', 'education.record',
    'appointments.view', // own schedule only, row-scoped
    'inventory.view',
    'scheduling.view', // own shifts/attendance only, row-scoped
  ],
  Nurse: [
    'patients.create', 'patients.view', 'patients.history.view',
    'animalbite.assessment.create', 'animalbite.treatment.administer',
    'consultation.assessment.create',
    'education.record',
    'appointments.view',
    'inventory.view', 'inventory.adjust',
    'scheduling.view',
  ],
  Cashier: [
    'patients.view', // billing-relevant fields only, enforced in the patients module's service layer
    'appointments.view',
    'billing.create', 'billing.view', 'payment.process',
    'scheduling.view',
  ],
};

module.exports = { ROLE_DEFAULTS };
