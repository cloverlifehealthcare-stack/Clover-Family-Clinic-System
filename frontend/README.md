# Clover Clinic — Staff SPA

React + Vite. Auth & RBAC foundation, Patients, Animal Bite Center, Consultations, and
Appointments (book, check-in/complete/cancel/no-show, reschedule, double-booking rejection).
Billing has a working, tested API in `../backend` but no screen here yet; its nav link goes to a
"coming soon" placeholder.

**Verified in a real browser against the live API**, not just built:

- Logged in as the seeded Management account (all 7 nav items show); created a Nurse account via
  the API and confirmed their nav shows only the 5 items their permissions actually cover (no
  Billing, no Staff Accounts); confirmed logout returns to `/login`; confirmed navigating a Nurse
  directly to `/billing` by URL — not just hiding the link — renders "Access denied" rather than
  the page, since the API would reject it anyway (§1.1: the client never decides what's allowed,
  it only reflects what the server already permitted).
- Patients: created an adult patient (code generated correctly, no guardian section shown);
  created a minor and confirmed the guardian fields appear and are required, both client-side
  (HTML5 `required`, blocked submission) and would be server-side regardless; re-submitted the
  exact same adult patient and confirmed the duplicate-warning screen shows the existing match,
  then confirmed "create anyway" actually creates a second record; edited a patient's contact
  number and confirmed it saved; created a Cashier account and confirmed their view of a patient
  shows only the basic/billing-relevant fields (no email, address, medical history, guardian
  info, or Edit button) — the backend's field-level restriction reflected correctly in the UI.
- Animal Bite Center: ran the full workflow start to finish through the actual UI — created a
  record (status `assessed`), recorded a Category III diagnosis (Doses and RIG sections both
  correctly appeared, since only shown for Category II/III and III respectively), administered
  dose 0 immediately (status auto-advanced to `in_treatment` — the same dose 0 that was a real
  falsy-zero backend bug two turns ago, confirmed fixed end-to-end through the UI too), recorded
  RIG, logged education, scheduled and completed a follow-up, then marked the whole record
  complete (status `completed`, form replaced by read-only summary).
- Consultations: used the `PatientPicker` landing to find a patient by search, clicked through
  to their consultations, created one, confirmed the prescription form is hidden until a
  diagnosis exists ("Record a diagnosis before issuing a prescription"), recorded a diagnosis,
  then issued a two-medicine prescription — added a second row via "+ Add another medicine" and
  confirmed both items saved and displayed correctly — then logged education, scheduled and
  completed a follow-up, and marked the consultation complete.
- Appointments: booked one via the `PatientSearchSelect` inline picker + the doctor dropdown
  (confirmed correctly populated from the new `/api/users/doctors` endpoint — see backend log),
  ran Check In → Complete and confirmed the action buttons update per status, confirmed the list
  page shows patient/doctor names (not raw IDs — the other real backend gap found this session,
  fixed in the same commit range), and confirmed double-booking the same doctor/date/time
  surfaces the backend's 409 as a clear on-screen message rather than a silent failure.

Two real backend gaps were found and fixed while building this module, not just frontend work —
see the backend README and git log: Admin had no way to fetch the doctor list (only
`users.manage`-gated endpoints existed) and appointment responses had bare `patient_id`/
`doctor_id` with no names, unlike every other module.

One real testing-tool quirk hit along the way, not an app bug: the browser automation's
coordinate-based click occasionally missed the actual button (confirmed by dispatching `.click()`
directly via JS and seeing the expected network request fire immediately after). Worth knowing if
a future click-based test seems to silently do nothing — try a direct DOM `.click()` to rule out
the same thing before assuming the app is broken.

## Running it locally

Needs the backend running first — see `../backend/README.md`.

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL defaults to http://localhost:4000/api, fine for local dev
npm run dev
# -> http://localhost:5173
```

## What's here

- **`src/api/client.js`** — fetch wrapper: attaches the access token, retries once through a
  silent refresh on a 401, forces logout if the refresh itself fails. Every module's future API
  calls should go through this (`api.get/post/patch/put`), not raw `fetch`.
- **`src/auth/AuthContext.jsx`** — session state (`loading` / `authenticated` / `unauthenticated`),
  restores a session on page reload from the stored access token, exposes `login`, `logout`,
  `hasPermission(code)`.
- **`src/auth/ProtectedRoute.jsx`** — redirects to `/login` if unauthenticated; renders "Access
  denied" if authenticated but missing a required `permission` prop. This is a UX convenience,
  not the actual security boundary — the API enforces every permission independently and would
  reject the request either way.
- **`src/layout/AppShell.jsx`** — topbar + sidebar nav, filtered by `hasPermission()` per link.
  Nav item → permission code mapping lives in `NAV_ITEMS` at the top of that file.
- **`src/pages/patients/`** — `PatientsListPage` (search), `PatientCreatePage` (handles the
  backend's 409 "possible duplicate" response as an expected outcome, not an error — via
  `apiRequestRaw` in `api/client.js`, which returns `{status, data}` instead of throwing),
  `PatientDetailPage` (renders whichever fields the backend actually sent — Cashier's reduced
  shape vs. the full record — rather than assuming a fixed field set), `PatientEditPage`. The
  shared `PatientForm` shows/requires the guardian fields client-side via `utils/age.js`, mirroring
  (not replacing) the backend's own minor check.
- **`src/components/PatientPicker.jsx`** — shared "search for a patient first" landing, used by
  both Animal Bite Center and Consultations, since neither has a standalone global list on the
  backend by design — those records only make sense in the context of one patient.
- **`src/pages/animal-bite/`** — `AnimalBiteLandingPage` (picker), `PatientAnimalBiteRecordsPage`
  (list for one patient), `AnimalBiteCreatePage` (initial assessment), `AnimalBiteDetailPage` (the
  rest: diagnosis, doses, RIG, education, follow-ups, completion, each as its own section
  component in the same file, re-setting the whole record from each mutation's response rather
  than a separate refetch, since every backend endpoint already returns the full updated record).
- **`src/pages/consultations/`** — same shape as `animal-bite/`, minus doses/RIG, plus a
  `PrescriptionsSection` supporting a dynamic list of medicine rows ("+ Add another medicine")
  submitted as one multi-item prescription; hidden until the consultation has a diagnosis,
  matching the backend's own requirement.
- **`src/components/PatientSearchSelect.jsx`** — inline "type to search, click to select" patient
  field for forms that need a `patientId` without leaving the page (booking an appointment),
  unlike `PatientPicker`'s full-page landing.
- **`src/pages/appointments/`** — `AppointmentsListPage` (date-filtered), `AppointmentCreatePage`
  (patient search-select + doctor dropdown from `/api/users/doctors` + a generated 15-minute
  time-slot `<select>`, 08:00–17:00), `AppointmentDetailPage` (status actions gated by the
  current status per the backend's own transition rules, plus reschedule while still
  `scheduled`).

## Known gaps

- **Tokens live in `localStorage`**, not an httpOnly cookie, because the backend's
  `POST /api/auth/login` returns both tokens in the JSON response body — there's no cookie for
  the browser to use instead. That's a real XSS trade-off: anything that can run JS on this page
  can read the tokens. Fine for now; revisit (cookie-based refresh token, at minimum) before this
  handles real patient data in production.
- No build/deploy pipeline yet — `npm run build` produces a static `dist/`, matching the hosting
  proposal in `../docs/clover-architecture.md` §1.3, but nothing wires that up yet.
