# Clover Clinic — Patient Portal

React + Vite, **a deliberately separate app from `frontend/`** — not a new section bolted onto
the staff SPA. Per `docs/clover-architecture.md` §1.3: different audience (patients, not staff),
different auth flow (self-registration/login against a completely separate `patient_accounts`
table and JWT secret pair — see `backend/README.md`), different security posture (public-facing,
rate-limited registration). Talks to the same backend API, at `/api/patient-auth/*` and
`/api/patient/*` rather than the staff routes.

## v1 scope: adults only

A minor cannot legally create their own login, and the architecture doc doesn't specify a
guardian-account model. Rather than guess at one, self-registration is rejected outright for
anyone under 18 (checked server-side against `dateOfBirth`, not just hidden client-side) with a
message directing them to visit the clinic in person or have a guardian call staff directly.
Guardian-managed accounts (a parent registering and booking on behalf of one or more minor
dependents) are a real follow-up, not built here — it needs its own design pass (a
guardian-to-patient relationship model, consent handling), not a quick addition.

## What's here

- **Register** (`/register`): first name, last name, date of birth, contact number, email,
  password (8+ chars). Creates a **new** `patients` record every time — it never links to an
  existing one, even after the duplicate-warning screen is confirmed. Auto-linking based on
  name + date of birth (both guessable/public facts) would let anyone who knows those two things
  about an existing patient claim their portal account and read their full medical history — a
  real PHI exposure under the Philippine Data Privacy Act (RA 10173), not a hypothetical one. A
  patient who already has an in-person record and wants it linked to a new portal account has to
  go through staff, who can verify identity face to face; that linking tool isn't built yet.
- **Login/Logout** (`/login`): same lockout-after-repeated-failures and rotating-refresh-token
  pattern as staff auth, against the separate `patient_accounts` table.
- **My Appointments** (`/`): lists the logged-in patient's own appointments only (never another
  patient's — enforced server-side, not just by what the UI requests) and lets them cancel one
  that's still `scheduled`.
- **Book Appointment** (`/book`): same doctor list, 15-minute slot grid, and double-booking
  prevention as the staff booking flow — reuses the exact same backend service, not a
  reimplementation.
- **My Profile** (`/profile`): view full record; edit **contact number and address only**. Name,
  date of birth, and portal email/password are not self-editable — those are identity-sensitive
  and stay staff-only to change, and there's no self-service email/password-change flow built yet
  (same kind of trim as the staff password-reset gap flagged in `backend/README.md` since Phase 1).

**Verified in a real browser against the live API**, not just built: registered a new adult
patient (auto-logged-in afterward, landed on an empty "My Appointments" page); edited contact
number/address on the Profile page and confirmed it saved and reloaded correctly; created a
Doctor via the staff API and booked an appointment through `/book` — confirmed it appeared
correctly formatted on the dashboard, then cancelled it and confirmed the status badge and the
Cancel button both updated without a page reload; registered with the same name + date of birth
as an existing patient and confirmed the "Is this you?" screen appeared with the existing
record's details, confirmed "create anyway" creates a **separate** new record (verified the two
patient IDs differ) rather than linking; registered with a date of birth under 18 and confirmed
the server-side rejection message renders clearly, not just a generic error.

One real backend bug was found and fixed while verifying this in the browser, not caught by any
automated test until the regression was added afterward: `POST /api/patient-auth/register` and
several other genuinely public endpoints were returning 401 with no Authorization header sent at
all. Root cause was in `backend/src/app.js`, not this app — see that repo's README for the full
explanation (several existing routers mounted at the bare `/api` prefix were unconditionally
running staff `requireAuth` on every request that reached them, since they're registered before
the patient routes were). Fixed by moving `/api/patient-auth` and `/api/patient` earlier in the
route registration order.

## Running it locally

Needs the backend running first — see `../backend/README.md`. Runs on port **5174** (the staff
SPA in `frontend/` uses 5173), so both can run side by side during development.

```bash
cd patient-portal
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000/api, fine for local dev
npm run dev
# -> http://localhost:5174
```

## Known gaps

- No self-service password reset or change, and no self-service portal-email change — see "My
  Profile" above.
- No linking tool for an existing (staff-created) patient to a new portal account — see
  "Register" above. Until one exists, a returning patient who self-registers gets a second,
  disconnected patient record rather than seeing their prior visit history through the portal.
- Same `localStorage` token storage trade-off as `frontend/`'s client — see that README's "Known
  gaps" for the reasoning; applies identically here.
- Guardian-managed accounts for minors aren't built (see "v1 scope" above).
