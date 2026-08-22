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

  // Phase 2. Not part of the original §3.2 matrix (that only covered Phase 1 modules) — role
  // defaults below are a reasonable inferred split, not a documented business rule: Management/
  // Admin/Nurse can adjust stock (receive batches, log corrections/wastage), matching who
  // physically handles supplies in a small clinic; Doctor gets view-only (useful to check RIG/
  // vaccine availability before committing to a treatment decision); Cashier has no reason to
  // touch inventory. Flag if this doesn't match how the clinic actually wants it split.
  { code: 'inventory.view', module: 'inventory', description: 'View stock levels, batches, and expiration/reorder alerts' },
  { code: 'inventory.adjust', module: 'inventory', description: 'Receive stock, and record corrections/spoilage/wastage' },

  // Also Phase 2, also not in the original §3.2 matrix. Every role gets scheduling.view by
  // default (everyone should be able to see their own shifts and clock themselves in/out —
  // that's handled by requireAuth alone on the self-service endpoints, not gated by a
  // permission, since it only ever touches the caller's own record); scheduling.manage
  // (assign shifts, correct/override attendance for other staff) is Management/Admin only,
  // mirroring the appointments.manage split.
  { code: 'scheduling.view', module: 'scheduling', description: "View shifts and attendance (own, unless scheduling.manage)" },
  { code: 'scheduling.manage', module: 'scheduling', description: 'Assign staff shifts and record/correct attendance for others' },

  // Third Phase 2 module, same non-matrix situation. Management/Admin only — unlike
  // scheduling.view, there's no "view my own reminders" case here (reminders go to patients,
  // not staff), so no role needs default access beyond the two that run/monitor the job.
  { code: 'reminders.view', module: 'reminders', description: 'View the reminder send log' },
  { code: 'reminders.manage', module: 'reminders', description: 'Manually trigger the reminder job' },

  // Phase 3, also not in the original §3.2 matrix (which only covered Phase 1). financial.view
  // already existed as a Phase 1 placeholder code ("View profit / expense / financial reports")
  // per §3.2's business rule — Management only by default, Admin only via an individual
  // user_permissions override, never a role default. financial.manage (record/void expenses) is
  // new but follows the same restriction, since it's part of the same sensitive bucket.
  { code: 'financial.manage', module: 'financial', description: 'Record and void expenses' },

  // Daily Activity Report is operational (visit/appointment/attendance counts), not financial —
  // it deliberately excludes revenue figures so it can default to Management + Admin without
  // reopening the "Admin can't see profit reports" rule through a side door. See
  // reports.service.js for the reasoning in one place.
  { code: 'reports.view', module: 'reports', description: "View the Daily Activity Report" },
];

module.exports = { PERMISSIONS };
