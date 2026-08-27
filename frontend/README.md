# Clover Clinic — Staff SPA

React + Vite. **All six Phase 1 modules have screens**: Auth & RBAC, Patients, Animal Bite
Center, Consultations, Appointments, and Billing. **All three Phase 2 modules are done too**:
Inventory, Staff Scheduling & Attendance, and Follow-up Reminders. **So are both Phase 3
modules**: Financial Management and Daily Activity Reports. **Three of Phase 4's modules are
done too**: the Full Audit Log UI, the Patient Portal (a separate app — see `../patient-portal/`),
and the clinical/operational trends half of Advanced Reports. Only the backup half of Advanced
Reports remains, and it's blocked on a real cloud hosting account rather than out of scope by
choice — see `../backend/README.md` for why Phase 2–4's design isn't documented up front the way
Phase 1's was, and for the backup blocker.

**Verified in a real browser against the live API**, not just built:

- Logged in as the seeded Management account (all 14 nav items show); created a Nurse account via
  the API, confirmed via `GET /api/auth/me` exactly which permissions they hold, and confirmed
  their nav shows only the 7 items those permissions actually cover — Dashboard, Patients, Animal
  Bite Center, Consultations, Appointments, Inventory, Scheduling (no Billing, no Reminders, no
  Daily Activity, no Financial, no Audit Log, no Staff Accounts); confirmed logout returns to
  `/login`; confirmed
  navigating a Nurse directly to `/billing` by URL — not just hiding the link — renders "Access
  denied" rather than the page, since the API would reject it anyway (§1.1: the client never
  decides what's allowed, it only reflects what the server already permitted).
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

Two real backend gaps were found and fixed while building the Appointments module, not just
frontend work — see the backend README and git log: Admin had no way to fetch the doctor list
(only `users.manage`-gated endpoints existed) and appointment responses had bare `patient_id`/
`doctor_id` with no names, unlike every other module.
- Billing: created a statement using the services-catalog dropdown (confirmed it auto-fills
  description/price, still editable), applied a Senior Citizen discount (confirmed the 20%
  applied only to the discount-eligible line, matching the backend's per-item logic), recorded a
  partial payment (status → `partially_paid`), paid the remaining balance (status → `paid`,
  payment form correctly disappeared since balance was ₱0), voided one payment (status correctly
  reverted to `partially_paid`, balance recalculated), and confirmed voiding the whole statement
  is blocked with a clear message while an active payment remains — the exact rule from the
  backend's billing test suite, now visible as real UI behavior instead of just a passing test.
- Print Statement (post-launch addition, at the clinic's request, styled as a customer-facing
  invoice): the billing statement detail page (`BillingDetailPage.jsx`) now fetches the patient
  record alongside the statement and renders a second, print-only view (`.print-only`, hidden on
  screen, shown via a `@media print` rule that also hides the app's nav/topbar and every
  interactive control) — an invoice layout with the clinic's logo/name/contact, a bolded status
  stamp (Paid/Unpaid/Partially Paid/Void), a "Bill To" block with the patient's name/code/contact,
  the itemized charges, a totals block ending in Balance Due, and payment history with OR
  numbers. The "Print Statement" button just calls `window.print()` — no PDF library, server
  round-trip, or new backend endpoint involved, since everything needed was already returned by
  the existing statement/patient endpoints. Verified by reading the print-only DOM content
  directly (confirmed all fields populate correctly — patient name/code/contact, OR number,
  itemized line, subtotal/discount/total/paid/balance, payment history row) and confirming via
  computed styles that `.print-only` is `display: none` on screen and `.no-print` is visible,
  i.e. the two views don't show simultaneously.
- Inventory (Phase 2): created an item (correctly showed "low stock" at 0 remaining), received a
  batch with a near-term expiration date, confirmed the badge cleared once stock exceeded the
  reorder threshold, recorded a spoilage adjustment and confirmed remaining stock dropped by
  exactly that amount, and confirmed the list page's alert banner correctly flagged the batch as
  expiring within 30 days. Also confirmed a Cashier (no inventory permission at all) sees no
  Inventory nav link and gets "Access denied" navigating there directly by URL.
- Staff Scheduling & Attendance (Phase 2): clocked in as Management (buttons correctly
  toggled — Clock In disabled, Clock Out enabled — and the attendance table updated live),
  assigned a newly-created Doctor a shift via the staff-roster dropdown (populated from the new
  `/api/users/staff` endpoint — a second instance of the same permission gap the doctors
  endpoint fixed, this time caught proactively before testing rather than discovered live), then
  logged in as that Doctor and confirmed row-scoping end to end: their shift view shows only
  their own shift with no "Remove" button or assignment form (no `scheduling.manage`), and their
  attendance view correctly excludes Management's clock-in record from earlier.
- Follow-up Reminders (Phase 2): as Management, opened the empty log, clicked "Run Reminders
  Now" against a clean dataset (correctly reported `Sent 0, skipped 0, failed 0`), then created a
  patient and an appointment for tomorrow via the API and re-ran the job — the log populated with
  both the SMS and email rows (recipient, composed message, and "Sent" status badge all correct),
  and filtering by Type → Follow-up correctly narrowed the list to zero since only an appointment
  reminder existed. Confirmed the "Run Reminders Now" button and log filters are hidden/blocked
  per the same `reminders.view`/`reminders.manage` permission split used everywhere else.
- Financial Management (Phase 3): as Management, created a patient, a billing statement, and a
  payment via the API (₱800, OR-SMOKE-001), then confirmed the Financial page's Summary/Sales
  Journal all picked it up correctly (₱800 revenue, the journal row showing the right OR
  number/payor/amount), recorded a ₱150 expense through the on-screen form (Total
  Expenses/Net Profit updated live), then voided it through the same inline void-reason input
  pattern Billing uses — confirmed the status badge flipped to "Voided", the Void control
  disappeared, and Total Expenses/Net Profit recalculated to ₱0/₱800 without a page reload.
  Confirmed a Cashier (no `financial.view`) sees no Financial nav link and gets "Access denied"
  navigating there directly by URL.
- Purchases + Vaccine Cost Options (post-launch redesign of Sales Ledger, reworked twice more
  since — first to a flat-per-visit-type Service Fee Options, then to a per-doctor Doctor's Fee
  Options, both since removed once the clinic clarified doctor's fees are a variable daily amount
  tracked via Cash Disbursement instead, not attributable to a single visit — see
  `backend/README.md` for the full history): as Management, in a real browser end to end —
  created a Doctor and a Nurse staff account, registered a patient, created a vaccine Inventory
  item and received a batch against it, created a Category III animal-bite record, recorded its
  diagnosis as the new Doctor, and administered a dose linked to the tracked batch. Set that
  vaccine's current cost to ₱220 under Vaccine Cost Options through its on-screen inline input +
  Save button, confirmed to persist via a direct API read after saving. Created and paid a
  ₱1,500 animal-bite billing statement for that record, then confirmed the Purchases table showed
  exactly Sales ₱1,500.00, Cost of Goods ₱220.00, Net ₱1,280.00 — and confirmed the table has no
  Doctor's Fee column at all, matching the current design. Separately populated the clinic's real
  vaccine list (Equerab, Varixab N, Speeda-Purified, Abhayrab, Abhaytox) with their actual current
  costs, computed from a real supplier price sheet at their usual order quantity of 50 units.
- Cash Disbursement (post-launch addition, its Particulars field reworked once more into a
  category dropdown + free-text Reason at the clinic's request — this is also where doctor's fee
  payments get logged, see the Purchases entry above): as Management, in a real browser end to
  end — filled the on-screen Record Disbursement form (Date, Particulars "Doctor's Daily Fee",
  Reason "Dr. Reyes, 6 hours", Amount ₱600, Given To "Dr. Reyes") and confirmed the new row
  appeared in the table with the category label rendered correctly and Status "Active"; also
  confirmed the Summary recalculated to ₱0.00 − ₱0.00 − ₱600.00 = **-₱600.00**. Voided the row
  through the same inline void-reason input pattern Expenses/Billing use and confirmed the status
  badge flipped to "Voided" and the Void control disappeared, with no page reload needed. The
  Summary section was also reworked in an earlier pass into a literal equation (Total Revenue −
  Total Expenses − Total Cash Disbursement = Net
  Profit, with the Net Profit card visually highlighted); recorded a ₱250 disbursement via the
  API with no other activity in range and confirmed Summary correctly showed
  ₱0.00 − ₱0.00 − ₱250.00 = **-₱250.00**.
- Export Reports (post-launch addition, following the same download pattern already verified for
  Audit Log CSV export): as Management, clicked "Export Full Report" on the new Export Reports
  section and confirmed (by intercepting `document.createElement('a')`) that it triggered a real
  browser download with a date-ranged filename (`full-report-2026-08-01-to-2026-08-26.csv`);
  separately fetched the same underlying endpoint directly and confirmed the CSV content itself —
  the four Summary figures as rows plus a literal `Formula` row. Also fetched the Cash
  Disbursement export directly and confirmed its `Particulars` column renders the human label
  ("Doctor's Daily Fee") rather than the raw `doctors_fee` value, and that a `Reason` value
  containing a comma ("Dr. Reyes, 6 hours") is correctly CSV-quoted.
- Daily Activity Report (Phase 3): confirmed the page shows the same day's new-patient count via
  `newPatients`, and confirmed it deliberately carries no revenue/profit figures anywhere in the
  response — that stays under Financial Management, which is gated more narrowly. Also confirmed
  an out-of-range past date correctly returns all-zero counts rather than erroring.
- Full Audit Log UI (Phase 4): as Management, filtered by Action containing "void" against real
  data generated via the API (a patient, statement, payment, then a payment void) and confirmed
  exactly the `payment.void` row showed, with the correct entity type, entity ID, and IP address;
  clicked Export CSV and confirmed a real file downloaded via the browser's blob-URL mechanism
  (not a plain link, since the response needs an Authorization header). Caught one real backend
  bug here, not just a frontend issue: the Entity Type filter dropdown initially showed "user"
  four times — a duplicate-key React warning surfaced it, traced to the backend's distinct-values
  query, fixed and verified in the same pass (see backend README for the actual bug). Confirmed a
  Cashier (no `audit.view`) sees no Audit Log nav link and gets "Access denied" navigating there
  directly by URL.
- Advanced Reports — Trends (Phase 4): generated real data via the API (an animal-bite record
  diagnosed Category III, a completed follow-up, a consultation, a cancelled appointment) and
  confirmed all four sections — animal bite by category, consultation volume, follow-up
  completion, appointment outcomes — showed the correct counts and computed rates (100%
  completion, 100% cancellation) for the period they landed in. Switched the Group By selector
  from Month to Day and confirmed the same data re-grouped under today's exact date instead of
  the month's first day, live, without a page reload. Confirmed the nav highlighting itself: the
  new `/reports/trends` route nests under `/reports`, and `NavLink`'s default non-exact matching
  would have kept "Daily Activity" highlighted while viewing "Trends" — added `end` matching for
  `/reports` specifically and confirmed only one nav item highlights at a time now.

One real testing-tool quirk hit along the way, not an app bug: the browser automation's
coordinate-based click occasionally missed the actual button (confirmed by dispatching `.click()`
directly via JS and seeing the expected network request fire immediately after). Worth knowing if
a future click-based test seems to silently do nothing — try a direct DOM `.click()` to rule out
the same thing before assuming the app is broken.
- Dashboard (post-launch — the landing page had been a static "Welcome, {name}" message with no
  data since Phase 1; `DashboardPage.jsx` fully rewritten to fetch `GET /api/dashboard` and
  render whichever sections come back non-`null`, reusing the same `.summary-cards`/
  `.summary-card` styling as the Financial page's tiles, including the exact Total Revenue −
  Total Expenses − Total Cash Disbursement = Net Profit equation layout for the financial
  section): as Management, in a real browser end to end — registered a patient and created a
  same-day appointment through the API, reloaded the dashboard, and confirmed "New Patients
  Today" and "Appointments Today" both correctly incremented to 1, with the new appointment
  showing correctly in the Today's Appointments table (time, patient, doctor, status). Also
  logged in as a fresh Cashier account and confirmed the page renders cleanly with only the
  sections that role has permission for (Appointments Today, On Shift Today) — no crash, no
  blank cards, no console errors — with Daily Activity/Financial/Inventory/Follow-ups sections
  correctly absent rather than showing empty or zeroed placeholders.

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
- **`src/pages/billing/`** — `BillingLandingPage` (picker), `PatientBillingPage` (list),
  `BillingCreatePage` (dynamic charge rows, each optionally pre-filled from the `/api/services`
  catalog; PWD/Senior discount fields appear only when a discount type is selected, matching the
  minor-guardian pattern from `PatientForm`), `BillingDetailPage` (payments, per-payment void with
  an inline reason field instead of a `window.prompt()` — keeps it consistent with the rest of the
  app and testable the same way).
- **`src/pages/inventory/`** — `InventoryListPage` (with an alert banner for low-stock/expiring-
  soon), `InventoryCreatePage`, `InventoryDetailPage` (batches table with an inline
  receive-batch form and a per-batch inline adjustment form, same collapsible-form pattern as
  Animal Bite's dose/RIG sections).
- **`src/pages/scheduling/SchedulingPage.jsx`** — one page, not split into sub-routes like the
  other modules: a self-service clock-in/out widget, a date-filtered shifts table + assign-shift
  form, and a date-filtered attendance table + manual-correction form. `api/client.js` gained a
  `delete` method here — nothing before this needed one.

## Known gaps

- **Tokens live in `localStorage`**, not an httpOnly cookie, because the backend's
  `POST /api/auth/login` returns both tokens in the JSON response body — there's no cookie for
  the browser to use instead. That's a real XSS trade-off: anything that can run JS on this page
  can read the tokens. Fine for now; revisit (cookie-based refresh token, at minimum) before this
  handles real patient data in production.
- No build/deploy pipeline yet — `npm run build` produces a static `dist/`, matching the hosting
  proposal in `../docs/clover-architecture.md` §1.3, but nothing wires that up yet.
