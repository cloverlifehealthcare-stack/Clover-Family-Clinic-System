# Clover Clinic API — Auth & RBAC foundation

Implements the module listed first in `docs/clover-architecture.md` §7: authentication, roles,
and the permission framework. Nothing from later Phase 1 modules (patients, animal bite,
consultation, appointments, billing) is built yet — this is the base every one of them will sit on.

**Not yet run or tested in the environment this was written in** — no Node.js, npm, or Docker
were available there. Everything below is written to work, following the design in the
architecture doc, but hasn't been executed. Run it locally and report back anything that breaks.

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
- **Permission administration**: `GET /api/permissions`, `GET/PUT /api/permissions/users/:userId`
  — view and grant/revoke per-user overrides. Management only.
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
