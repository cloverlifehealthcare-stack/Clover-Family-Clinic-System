# Clover Clinic API — Phase 1 complete + Phase 2 in progress

Implements all six Phase 1 modules from `docs/clover-architecture.md` §7's build order:
auth/roles/permissions, patients, Animal Bite Center, Medical Consultation, appointments, and
billing. Phase 2 (§2: inventory, follow-up reminders, staff scheduling) has no detailed schema in
the architecture doc the way Phase 1 did — each Phase 2 module's design is worked out inline as
it's built, flagged clearly below and in code comments, the same way undocumented Phase 1 details
(e.g. the follow-up permission mapping) were resolved throughout. **Inventory** is done; follow-up
reminders and staff scheduling aren't started yet.

**Verified, not just written** — run against a real Postgres instance (Node 24, Docker Desktop,
this repo's `docker-compose.yml`): migrations apply cleanly, all seeds run, the server boots, real
round-trips (login, patient, animal-bite, consultation, appointment booking + double-booking
rejection, billing statement + PWD/Senior discount + payment to "paid") work over HTTP, and the
full test suite (70 tests) plus lint pass. Real bugs were caught and fixed along the way, not just
theoretical risks — see git log: `e48a077` (an env-var leak between Jest's setup process and its
test workers), the date type-parser fix in `src/db/knex.js` (Postgres DATE columns serializing a
day off due to timezone conversion), a falsy-zero bug where dose 0 — the actual first rabies
vaccine dose — was rejected by an `if (!doseNumber)` check, a missing "own patients" enforcement
gap on animal bite diagnosis (any doctor could overwrite another doctor's diagnosis), and a `NaN`
bug in payment totals where `+` silently did string concatenation instead of addition whenever
`amountPaid` arrived as a JSON string rather than a number — found by a live smoke test, since
the automated suite's number literals never exercised that path (a regression test for it now
exists in `tests/billing.test.js`).

## What's here

- **Roles & permissions**: `roles`, `permissions`, `role_permissions`, `user_permissions` tables,
  seeded from `src/config/permissions.js` (the full Phase 1 permission catalog) and
  `src/config/roleDefaults.js` (transcribed from the matrix in the architecture doc §3.2).
- **JWT auth**: `POST /api/auth/login`, `/refresh`, `/logout`, `GET /api/auth/me`. Short-lived
  access tokens, rotating refresh tokens, bcrypt password hashing, rate limiting + per-account
  lockout after repeated failed logins.
- **RBAC middleware**: `requirePermission('code')` — checks a per-user override first, falls back
  to the role default, and audit-logs every denial. This is what makes "Management and authorized
  Admin personnel" work: grant one permission to one Admin without a special case in code.
- **User management**: `GET/POST /api/users`, deactivate/reactivate — Management only.
  `GET /api/users/doctors` is the one exception: gated by `appointments.manage` (Admin has it)
  rather than `users.manage` (Management only), returning just `{id, full_name}` for active
  Doctors — enough to build an appointment's doctor picker without exposing the full staff
  roster. Added while building the frontend's appointment form and discovering Admin had no way
  to fetch the doctor list otherwise.
- **Patients**: `GET/POST /api/patients`, `PATCH /api/patients/:id`. `patient_code` is generated
  atomically (`MMYY-NNNN`, resets monthly). Creating a likely duplicate (same first/last name +
  DOB) returns `409` with the matches instead of silently creating one — resubmit with
  `confirmDuplicate: true` to proceed anyway. A minor (under 18) requires `guardianName`,
  `guardianRelationship`, `guardianContactNumber`. Field visibility on read is gated by
  `patients.history.view`: Cashier (billing-relevant fields only) gets a smaller shape than
  Doctor/Nurse/Management (full record), per the §3.2 matrix.
- **Permission administration**: `GET /api/permissions`, `GET/PUT /api/permissions/users/:userId`
  — view and grant/revoke per-user overrides. Management only.
- **Animal Bite Center**: `POST /api/animal-bite-records` (initial assessment — vitals, exposure,
  wound), `PATCH /:id/diagnosis` (doctor's WHO Category I/II/III + treatment decision),
  `POST /:id/doses` and `PATCH /:id/doses/:doseId/administer` (schedule now or later, dose 0
  included — see the falsy-zero bug above), `POST /:id/rig` (Category III only, once per record,
  both enforced), `POST /:id/education`, `POST /:id/follow-ups` +
  `PATCH /:id/follow-ups/:followUpId`, `POST /:id/complete`. Status auto-advances
  assessed → in_treatment on the first dose/RIG; `complete` is an explicit action. Viewing a
  record requires `patients.history.view` (no separate permission exists for it in the §3.2
  matrix — it's part of that patient's medical history); follow-up scheduling is gated by
  `animalbite.treatment.administer` for the same reason (see code comment in
  `animalBite.routes.js` — no dedicated permission exists for it either). Diagnosis is
  restricted to the diagnosing doctor (or Management) once set — "own patients" per §3.2.
- **Medical Consultation**: `POST /api/consultations` (initial assessment), `PATCH /:id/diagnosis`
  (own-patients enforced, same as animal bite), `POST /:id/prescriptions` (also own-patients
  enforced — requires a diagnosis first), `POST /:id/education`, `POST /:id/follow-ups` +
  `PATCH /:id/follow-ups/:followUpId` (gated by `education.record`, the closest analogous
  permission — no dedicated one exists), `POST /:id/complete`. Referral notes go in the
  `remarks` field — the doc's schema has no dedicated referral column, so this follows it
  exactly rather than adding one.
- **Billing**: `POST /api/billing/statements` (charges + PWD/Senior 20% discount, applied only to
  discount-eligible line items), `GET /:id`, `GET /api/patients/:patientId/billing-statements`,
  `POST /api/billing/statements/:id/payments` (status auto-advances unpaid → partially_paid →
  paid; rejects overpayment past the remaining balance; `orNumber` required — typed in from the
  clinic's manual OR booklet, §0/§6), `POST /:id/void` and `POST /api/billing/payments/:paymentId/void`
  — both `payment.void` (Management + Admin, §0), no delete endpoint exists for either by design.
  Voiding a statement is blocked while it has active payments — void those first, then the
  statement — so a statement never silently loses track of money that was actually collected.
  `GET/POST/PATCH /api/services` is a minimal pricing catalog (`billing.create` gates writes —
  no dedicated "manage catalog" permission exists in §3.2, so this reuses the closest fit).
- **Appointments**: `POST/GET /api/appointments`, `GET /:id`, `PATCH /:id` (reschedule, only
  while still `scheduled`), `POST /:id/check-in`, `/complete`, `/cancel`, `/no-show`. All 15-minute
  slots (§0); double-booking is blocked by a partial unique index on
  `(doctor_id, scheduled_date, scheduled_time) WHERE status <> 'cancelled'` — a cancelled
  appointment correctly frees its slot for rebooking, which a plain unique constraint would not.
  Create/reschedule/status-change require `appointments.manage` (Management/Admin only, per
  §3.2 — Doctor/Nurse/Cashier get `appointments.view` only); a Doctor's view is row-scoped to
  their own schedule in the service layer ("👁 own schedule"). Every response joins in
  `patient_first_name`/`patient_last_name`/`patient_code`/`doctor_name` — added after the
  frontend appointment form needed patient/doctor names, not bare IDs, matching how every other
  module already returns human-readable data.
- **Inventory** (Phase 2, no doc spec — schema is an inferred extrapolation, see the migration
  comments): `GET/POST /api/inventory` (items, with `totalRemaining`/`lowStock` computed across
  batches), `GET /:id` (item + its batches), `PATCH /:id`, `POST /:id/batches` (receive stock),
  `POST /batches/:batchId/adjustments` (correction/spoilage/expired, bounded to
  `[0, quantity_received]` by both a DB CHECK constraint and an app-layer check that returns a
  clean 400 instead of a raw constraint-violation 500), `GET /alerts` (low-stock items,
  batches expiring within N days). Gated by two new permissions not in the original §3.2 matrix:
  `inventory.view` and `inventory.adjust` — role defaults are a reasoned guess (Management/Admin/
  Nurse can adjust, Doctor view-only, Cashier none), not a transcribed business rule; flag if
  wrong. Optionally linked into Animal Bite dose/RIG administration: passing `inventoryBatchId`
  auto-derives `batch_lot_number` from the batch and decrements its stock by 1 on administration
  — fulfills the upgrade path the Phase 1 migrations' own comments already called out
  ("free text in Phase 1; FK to Inventory in Phase 2"). Purely additive: the free-text
  `batchLotNumber` field still works standalone for anyone not tracking a specific item yet.
- **Audit logging**: every login attempt, permission denial, user creation/deactivation, and
  permission override write an `audit_logs` row, per the architecture doc's §1.4 security baseline.

## Running it locally

```bash
# 1. Start Postgres (from the repo root, not backend/)
docker compose up -d

# 2. Install dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set real JWT_ACCESS_SECRET / JWT_REFRESH_SECRET
# (node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
# and a real SEED_MANAGEMENT_PASSWORD.

# 4. Create the schema and seed roles/permissions/the first Management account
npm run migrate
npm run seed

# 5. Run it
npm run dev
# -> http://localhost:4000/health should return {"status":"ok"}
```

Log in as the seeded Management user (`SEED_MANAGEMENT_EMAIL` / `SEED_MANAGEMENT_PASSWORD` from
`.env`), then use `POST /api/users` to create real staff accounts and stop using the seed account
day-to-day.

## Running the tests

Tests run against a real (disposable) Postgres database — they migrate and seed it from scratch.
**Never point `TEST_DATABASE_URL` at a database with real data**, the seed wipes RBAC/user tables.

```bash
# with docker compose's db already running:
createdb -h localhost -U clover clover_clinic_test   # or: docker exec -it <container> createdb -U clover clover_clinic_test
export TEST_DATABASE_URL=postgres://clover:clover@localhost:5432/clover_clinic_test
npm test
```

## Adding a permission-gated route in a later module

The permission catalog and role defaults already exist for modules not yet built (animal bite,
consultation, billing, ...) — see `src/config/permissions.js`. Wiring up a new endpoint is just:

```js
router.post('/animal-bite-records', requireAuth, requirePermission('animalbite.assessment.create'), controller.create);
```

Row-level rules ("own patients only", "own actions only") are **not** part of the permission
check — they're a second check the module's service layer applies after the permission check
passes, per the architecture doc's §5.4 two-stage flow. `req.user.id` / `req.user.roleId` are
available from `requireAuth` for that filtering.

## Known gaps / next decisions

- No password-reset flow yet (Management resets by re-issuing a temporary password via a future
  `PATCH /api/users/:id/password` — not built, since nothing in the spec defined the desired UX
  for it).
- `doctor_profiles` (license/PTR number) isn't created yet — it belongs with the Patient/Doctor
  module next, not the auth foundation, but the `users` table it extends is ready for it.
- Single-session logout isn't possible in Phase 1 (see comment in `auth.service.js`) — logging out
  invalidates every refresh token for that user. Fine for a small single-location staff; revisit
  if that becomes a real problem.
- `cors()` currently allows any origin. Fine for local development; before staging/production,
  lock it to the actual frontend origin(s) (`cors({ origin: [...] })`) once that URL is known.
