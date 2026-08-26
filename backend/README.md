# Clover Clinic API — Phase 1 + Phase 2 + Phase 3 complete, Phase 4 underway

Implements all six Phase 1 modules from `docs/clover-architecture.md` §7's build order:
auth/roles/permissions, patients, Animal Bite Center, Medical Consultation, appointments, and
billing. Phase 2, 3, and 4 (§2: inventory, staff scheduling, follow-up reminders, financial
management, daily activity reports, full audit log UI, patient portal) have no detailed schema
in the architecture doc the way Phase 1 did — each module's design is worked out inline as it's
built, flagged clearly below and in code comments, the same way undocumented Phase 1 details
(e.g. the follow-up permission mapping) were resolved throughout. **All three Phase 2 modules —
Inventory, Staff Scheduling & Attendance, and Follow-up Reminders — both Phase 3 modules —
Financial Management and Daily Activity Reports — and the Full Audit Log UI, the Patient Portal,
and the clinical/operational half of Advanced Reports from Phase 4 — are done.** Reminders send
through a pluggable stub provider (logs instead of actually sending) since real Globe/Gmail
credentials don't exist yet — see below. Advanced Reports' scope was picked via a direct question
back to the user rather than guessed at, since the doc names it in one line with no further spec:
date-range clinical/operational trend reports, not a data-export toolkit or staff-performance
reports (both considered, neither chosen). The backup half of that module isn't started — see
"Known gaps" for why.

**Verified, not just written** — run against a real Postgres instance (Node 24, Docker Desktop,
this repo's `docker-compose.yml`): migrations apply cleanly, all seeds run, the server boots, real
round-trips (login, patient, animal-bite, consultation, appointment booking + double-booking
rejection, billing statement + PWD/Senior discount + payment to "paid") work over HTTP, and the
full test suite (133 tests) plus lint pass. Real bugs were caught and fixed along the way, not just
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
- **Staff Scheduling & Attendance** (Phase 2, no doc spec): `GET/POST /api/scheduling/shifts`,
  `DELETE /:id` (assigning/removing staff shifts — `scheduling.manage`, Management/Admin only);
  `POST /api/scheduling/attendance/clock-in` and `/clock-out` (self-service — gated by
  authentication alone, not a permission, since it only ever touches the caller's own record,
  same reasoning as a Doctor's own appointment schedule); `GET /api/scheduling/shifts` and
  `/attendance` (row-scoped to the caller's own records unless they hold `scheduling.manage`,
  same pattern as Doctor's "own schedule only" in Appointments); `POST /api/scheduling/attendance`
  (manual correction/override for any staff member — `scheduling.manage`). Deliberately **not**
  wired into appointment booking (whether a doctor is actually scheduled to work when an
  appointment is booked against them) — that's a natural next step once this existed, but doing
  it now risked changing already-shipped Phase 1 appointment behavior; left as a flagged
  follow-up in the migration comment, not silently skipped. Overnight shifts (crossing midnight)
  aren't supported.
- **Follow-up Reminders** (Phase 2, no doc spec beyond §0's confirmed channels): `POST
  /api/reminders/run` (`reminders.manage`, Management/Admin only — finds animal-bite/consultation
  follow-ups and appointments due `daysBefore` days out — default 1, i.e. "tomorrow" — and sends
  an SMS and/or email per patient depending on which contact info they have), `GET /api/reminders`
  (`reminders.view`, the send log). **Not self-scheduling** — nothing in the app calls this
  automatically; a real deployment should point an external scheduler (system cron, a hosted
  scheduler, or `node-cron` added later) at this endpoint on a daily cadence. Idempotent: a
  unique constraint on `(source_type, source_id, channel)` in `reminder_logs`, checked before
  sending, means running the job twice in a day never double-sends the same reminder — a failed
  send still counts as "attempted," so this isn't a retry queue.
  `src/services/notifications/{sms,email}Provider.js` are the pluggable seams: each picks an
  implementation via `SMS_PROVIDER`/`EMAIL_PROVIDER` in `.env` (both default to `stub`, which
  logs the message instead of sending — see `providers/stub*Provider.js`), so adding a real
  Globe SMS client or Gmail SMTP client later is a new file plus one env var, not a change to
  `reminders.service.js`.
- **Financial Management** (Phase 3, no doc spec beyond §2's one-line name and §0's "pending your
  accountant/bookkeeper's sign-off before go-live"): `GET/POST /api/financial/expenses`,
  `POST /:id/void` (`financial.manage`, Management only by default — Admin needs an individual
  `user_permissions` override, per §3.2's "a staff member cannot view Management's profit
  reports" rule extended to the whole financial bucket); `GET /api/financial/sales-journal`,
  `/purchases`, `/summary` (`financial.view`, same restriction, all take `startDate`/`endDate`
  query params). The Sales Journal is computed from the existing `payments` table rather than a
  duplicated one — a payment is the actual revenue-recognition event (that's when an OR number is
  issued), so the journal is one row per payment, the BIR Manual Books of Accounts columnar format
  named in §0. A statement's PWD/Senior discount is shown on its journal row as a flag
  (`discount_type`), not pro-rated into a dollar figure per partial payment — the discount was
  approved once against the whole statement, and splitting it across payments would invent a
  number this system can't actually verify. `financial.manage`/`financial.view` are **not**
  substitutes for an accountant's review before these are treated as official books — flagged on
  the frontend page itself, not just here. `expenses` is a new table with the same void pattern
  (`status`/`void_reason`/`voided_by`/`voided_at`) as `payments` — no hard delete, for the same
  audit reasons.
  - **Purchases** (post-launch redesign of the original Sales Ledger, at the clinic's explicit
    request — not a relabel, the shape changed): one row per billing statement (not per payment,
    unlike the journal), showing sales less cost of goods. A statement is included if it has at
    least one active payment with `paid_at` in the queried range; its sales figure is the
    statement's full amount collected to date (all active payments, not just the ones inside the
    range) — this avoids double-counting cost of goods across partial payments or across
    reporting periods, at the cost of not being strictly date-scoped in the rare case a statement
    is paid off across more than one period. Cost of goods is looked up automatically, never
    entered manually: `getAnimalBiteCostOfGoods` in `src/modules/financial/financial.service.js`
    sums `inventory_items.current_cost` for every administered dose/RIG on the statement's
    animal-bite record that was linked to a tracked batch (`inventoryBatchId` at administration
    time — see Inventory below, joined through `inventory_batches` to the item); doses given
    against a free-text `batchLotNumber` instead contribute nothing, since there's no item to
    look a cost up for. Consultation and manual charges always show 0 cost of goods — there's no
    equivalent per-visit inventory consumption tracked for those.
    `inventory_items.current_cost` replaced looking up `inventory_batches.unit_cost` (a batch's
    historical purchase price, requiring Management to remember to enter it at every stock
    receipt) — one Management-editable standing figure per vaccine, updated whenever pricing
    changes rather than re-entered per shipment (`GET/PUT /api/financial/vaccine-costs/:itemId`).
    Verified with a real inventory-tracked dose (vaccine item's `current_cost` set to ₱220) and a
    ₱1,500 paid animal-bite statement producing an ₱1,280 net row — see `tests/financial.test.js`.

    Doctor's fee deliberately does **not** appear in Purchases, after two earlier attempts at it
    (first a flat fee per `billing_statements.source_type` via a `service_fees` table, then a fee
    per individual doctor via a `doctor_fees` table keyed by `animal_bite_records`/
    `consultations.doctor_id`) — both dropped once the clinic clarified doctors are actually paid
    a variable daily amount based on hours worked or patients seen, not a fixed rate attributable
    to a single visit or a single doctor. Doctor's fee payments are recorded as **Cash
    Disbursement** entries instead (see below), which already net against clinic-wide
    `netProfit` in `getSummary` — just not allocated to one specific patient visit. See
    `20260826010001_drop_doctor_fees.js`'s comment for the full history.
  - **Cash Disbursement** (post-launch addition, at the clinic's request): `GET/POST
    /api/financial/cash-disbursements`, `POST /:id/void` (view/manage-gated the same as
    Expenses). A new `cash_disbursements` table — date, category (`particulars` — "Doctor's Daily
    Fee" or "Other", added in a follow-up pass at the clinic's request, `CASH_DISBURSEMENT_CATEGORIES`
    in `financial.service.js`), reason (the free-text `particulars` column — e.g. "Dr. Santos, 8
    hrs"), amount, given-to — separate from `expenses` (which is categorized operating cost)
    since disbursements aren't tied to one of the fixed expense categories. This is also where
    the clinic records actual doctor's fee payments (see the Purchases entry above for why that's
    not computed automatically). Same void pattern (`status`/`void_reason`/`voided_by`/
    `voided_at`) as `expenses`/`payments` — no hard delete, for the same audit reasons.
    `GET /api/financial/summary`'s formula was updated in the same pass Cash Disbursement was
    added to `netProfit = totalRevenue - totalExpenses - totalCashDisbursements` (previously just
    revenue minus expenses) — the response now also returns `totalCashDisbursements` alongside
    the existing fields, and the frontend Summary section displays it as a literal equation.
- **Daily Activity Report** (Phase 3, no doc spec): `GET /api/reports/daily-activity?date=YYYY-MM-DD`
  (`reports.view`, Management **and** Admin by default — unlike financial data). Returns
  operational counts only (new patients, animal-bite visits/consultations/appointments by status,
  staff attendance by status) — **deliberately no revenue or profit figures**, so this can default
  to Admin without reopening the "Admin can't see profit reports" rule through a side door; see the
  comment at the top of `reports.service.js` for the reasoning kept in one place.
- **Audit logging**: every login attempt, permission denial, user creation/deactivation, and
  permission override write an `audit_logs` row, per the architecture doc's §1.4 security baseline.
- **Full Audit Log UI** (Phase 4, no doc spec beyond §2's one-line name): `GET /api/audit-logs`
  (filters: `startDate`/`endDate`, `action` — case-insensitive substring match, `entityType`,
  `userId`; capped at 1000 rows, 200 by default), `GET /api/audit-logs/entity-types` (distinct
  entity types, for populating the filter dropdown), `GET /api/audit-logs/export` (same filters,
  CSV, capped at 10,000 rows). This is the read side only — the write side (`auditLog.service.js`)
  has existed since Phase 1. All three gated by `audit.view`, with row-scoping that's a role
  check, not a separate permission (both Management and Admin hold the same `audit.view` code):
  Management sees every entry, Admin sees only entries where they were the acting user, per §3.2's
  "👁 own actions only." Found and fixed one real bug building this: `listEntityTypes`'s first
  version reused the main list query's full `SELECT audit_logs.*, users.full_name` and appended
  `.distinct('entity_type')` on top instead of replacing it, so the query deduped on every column
  — meaning it didn't dedupe entity_type at all. Automated tests didn't catch it (the assertion
  only checked `toContain('user')`, which passes whether or not duplicates exist); a live browser
  smoke test did (the dropdown visibly showed `user` four times). Fixed with `.clearSelect()` +
  `.clearOrder()` before applying `.distinct()`, and a regression test now asserts uniqueness.
- **Patient Portal** (Phase 4, no doc spec beyond §2's one-line name and §1.3's "separate app,
  different auth flow" note; adults-only for v1 — see `patient-portal/README.md`'s "v1 scope"):
  - `POST /api/patient-auth/register`, `/login`, `/refresh`, `POST /logout` + `GET`/`PATCH /me`
    (all under `patient-auth`, not `auth` — a completely separate `patient_accounts` table, not
    a new role in `users`). Registration always creates a **new** `patients` row, even when the
    caller confirms a possible-duplicate warning — never auto-links to an existing record based
    on name + date of birth, since both are guessable and auto-linking would be a real PHI
    exposure under RA 10173, not a hypothetical one. See `patientAuth.service.js`'s comment for
    the full reasoning, and `patient-portal/README.md` for the "call the clinic to link your
    history" UX this produces instead.
  - `GET /api/patient/doctors`, `GET`/`POST /api/patient/appointments`,
    `POST /api/patient/appointments/:id/cancel` — thin wrappers around the existing
    `appointmentsService`/`usersService` functions (same slot validation, same double-booking
    prevention, same state machine), not a reimplementation. Every call forces the caller's own
    `patientId` server-side; nothing here ever trusts a client-supplied patient ID.
  - **Separate JWT secret pair** (`PATIENT_JWT_ACCESS_SECRET`/`PATIENT_JWT_REFRESH_SECRET`,
    `patientToken.service.js`) from the staff pair — not just a different claim on the same
    token. A leaked staff secret must never be able to forge a patient session or vice versa;
    different secrets guarantee that structurally, a `type: 'patient'` claim is only a
    belt-and-suspenders check on top. `patients.created_by` and `appointments.created_by` are
    now nullable (two new migrations) — `NULL` means "the patient did this themselves," not
    staff.
  - Two new rate limiters (`patientLoginRateLimiter`, `patientRegisterRateLimiter`, tighter than
    login at 10/hour since each registration success creates a real patient record) — separate
    instances from the staff `loginRateLimiter`, not shared, so patient-portal traffic from a
    shared network can't exhaust the budget staff logins depend on.
  - **Two real bugs found and fixed while building this, both by a live smoke test — not by the
    initial automated tests**:
    1. Every genuinely public patient-auth endpoint (`register`, `login`) was returning 401 with
       *no* Authorization header sent at all. Root cause: `app.js` mounts `animalBiteRoutes`,
       `consultationsRoutes`, and `billingRoutes` at the bare `/api` prefix (see their own
       comments — they mix multiple path shapes so they can't use a single fixed prefix), and
       each applies `router.use(requireAuth)` unconditionally to *every* request that reaches
       it, since Express can't know in advance which of a router's specific routes (if any) a
       request will actually match. Every request under `/api/` was passing through at least
       one of them before reaching its real destination. That was invisible for staff
       endpoints — the same `requireAuth`, run redundantly early, still accepts a valid staff
       token — but it flatly rejected patient-auth's public endpoints, which correctly send no
       staff token at all. Fixed by registering `/api/patient-auth` and `/api/patient` earlier
       in `app.js`, ahead of the bare-`/api` mounts, the same way `/api/auth` already avoided
       this by being registered early. **This was a pre-existing latent issue in the routing
       structure, not something the Patient Portal introduced** — it just took a genuinely
       public new endpoint to expose it, since every prior module happened to require staff
       auth too.
    2. Once (1) was fixed, `patientPortal.test.js` still failed on ~3 of its own tests — a
       second issue, not a leftover of the first. That test file legitimately registers ~15
       accounts across its cases, exceeding `patientRegisterRateLimiter`'s real 10/hour cap
       within a single test run; the accounts past the limit got a 429 with no tokens, so later
       assertions using those (now-undefined) tokens 401'd. Rather than loosen the real limit to
       fit test volume, added a `skip: () => env.nodeEnv === 'test'` to every rate limiter — the
       same test-only carve-out `app.js` already uses for `morgan` logging, not a change to the
       actual policy. This also closes a latent flakiness risk in the existing staff
       `loginRateLimiter`, which had avoided this by luck: Jest gives each test *file* its own
       fresh `app.js` module (and so a fresh in-memory limiter store), and no single existing
       file happened to call `loginAs()` more than 30 times — but nothing guaranteed that would
       stay true as the suite grew.
- **Advanced Reports — Clinical & Operational Trends** (Phase 4, scope picked via
  AskUserQuestion — see the intro paragraph): `GET /api/reports/trends?startDate=&endDate=&groupBy=`
  (`reports.view`, same Management + Admin default as Daily Activity Reports; `groupBy` is
  `day`/`week`/`month`, defaulting to and falling back to `month` for anything else). Extends
  Daily Activity Reports from a single day to a range: animal-bite visits broken down by
  exposure category per period, consultation volume per period, follow-up completion rate
  (`completed / (completed + missed + cancelled)`, excluding `upcoming` follow-ups since those
  haven't happened yet), and appointment no-show/cancellation rates per period. Still
  deliberately no revenue or profit figures, same reasoning as Daily Activity Reports. Found and
  fixed one real bug immediately on the first test run, not by a live smoke test this time — the
  automated tests caught it themselves: `date_trunc(...)::date` produces a DATE-typed column,
  which the global type-parser override in `db/knex.js` (added back in Phase 1 for the
  `date_of_birth` timezone bug) returns as a plain `'YYYY-MM-DD'` string, not a JS `Date` — the
  same thing true of every other date column in this codebase (`visit_date`, `scheduled_date`,
  etc.), but easy to forget when the value comes from a computed expression instead of a table
  column. The first version called `.toISOString()` on it and crashed with a 500. Fixed by
  treating `row.period` as the string it already is, matching the convention used everywhere
  else.

## Running it locally

```bash
# 1. Start Postgres (from the repo root, not backend/)
docker compose up -d

# 2. Install dependencies
cd backend
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env — at minimum set real JWT_ACCESS_SECRET / JWT_REFRESH_SECRET and
# PATIENT_JWT_ACCESS_SECRET / PATIENT_JWT_REFRESH_SECRET (all four different values —
# node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"), and a real
# SEED_MANAGEMENT_PASSWORD.

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
- The backup half of Advanced Reports/Backup still isn't built: it's a hosting decision (managed
  Postgres with automated daily backups, §1.3) that needs a real cloud provider account —
  nothing to build in this repo until that account exists. The "advanced reports" half is done
  for the scope chosen (clinical/operational trends) — a data-export toolkit and staff-
  performance reports were considered and not picked; either is a reasonable, separately-scoped
  follow-up if wanted later.
- Patient Portal gaps (self-service password/email change, no tool to link an existing
  staff-created patient to a new portal account, no guardian-managed accounts for minors) are
  documented in `patient-portal/README.md`'s "Known gaps" rather than duplicated here.
