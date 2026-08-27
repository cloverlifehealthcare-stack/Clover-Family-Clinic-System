# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 is complete, backend and frontend.** All six modules — Auth & RBAC, Patients, Animal
Bite Center, Consultations, Appointments, Billing — are built and verified against a real
database and, for the frontend, in a real browser against the live API.

**Phase 2 is complete — Inventory, Staff Scheduling & Attendance, and Follow-up Reminders are
all done.** Unlike Phase 1, the architecture doc has no detailed schema for Phase 2 modules (§2
just names them); each module's design was worked out inline while building it, flagged clearly
in the migration comments and both READMEs rather than presented as a transcribed spec. Inventory
is optionally wired into Animal Bite Center: administering a dose or RIG against a tracked batch
decrements stock automatically. Scheduling includes self-service clock-in/out for any staff
member and row-scoped shift/attendance views, verified end to end as a Doctor seeing only their
own record. Follow-up Reminders sends SMS/email for tomorrow's appointments and animal-bite
follow-ups through a pluggable provider abstraction, currently backed by a stub that logs instead
of sending — real Globe/Gmail credentials don't exist yet, so it's ready to wire in without any
change to the calling code once they do.

**Phase 3 is complete — Financial Management and Daily Activity Reports are both done.** Same
non-matrix situation as Phase 2: §2 names these modules ("Financial Management (sales/expense/
profit, Sales Journal, Sales Ledger)", "Daily Activity Reports") without a schema, so the design —
an `expenses` table plus a Sales Journal/Ledger computed from the existing `payments` table rather
than a duplicated one — was worked out while building it. The Sales Journal/Ledger follow the BIR
Manual Books of Accounts columnar format for a Non-VAT (Percentage Tax) service business, exactly
as scoped in §0 — **pending your accountant/bookkeeper's sign-off before treating them as your
official books**, called out on the page itself, not just here. Daily Activity Reports are
deliberately operational-only (patient/appointment/attendance counts, no revenue figures) and
live under a separate `reports.view` permission — Management and Admin both get it by default,
unlike `financial.view`/`financial.manage`, which stay Management-only per §3.2's rule that a
staff member (Admin included) can't see profit reports without an individual override.

**Post-launch: the Sales Ledger was replaced with a Purchases report,** which then went through
two more rounds of correction as the clinic's actual financial practices became clearer. First,
the daily-cash-total Sales Ledger was redesigned into a per-patient profitability report: one row
per billing statement showing sales less cost of goods and doctor's fee. A **Cash Disbursement**
section was added to the same page in the same pass — a simple date/particulars/amount/given-to
record with the same void-not-delete pattern as Expenses, for cash paid out that isn't a
categorized operating expense. Cost of goods was then corrected to come from a Management-
editable "current cost" set per vaccine (Vaccine Cost Options), rather than a batch's historical
purchase price — populated with the clinic's real vaccine list and actual supplier pricing.
Doctor's fee went through two attempts (first a flat fee per visit type, then a fee per
individual doctor) before being **removed from Purchases entirely**: the clinic pays doctors a
variable daily amount based on hours worked or patients seen, not a fixed rate attributable to
one visit or one doctor, so it's tracked purely through Cash Disbursement instead — which already
reduces overall Net Profit in the Summary, just not allocated per patient. See `backend/README.md`
and `frontend/README.md` for the full design rationale and verification notes.

**Phase 4 is nearly complete — the Full Audit Log UI, the Patient Portal, and the reporting half
of Advanced Reports are all done.** Per §2, Phase 4 also includes a backup mechanism, not built
(a hosting decision requiring real cloud infrastructure, not something buildable without your
provider account — see `backend/README.md`). The Audit Log UI was picked first as the contained,
lowest-risk piece: the underlying `audit_logs` data has been captured since Phase 1 (§1.4); it
only adds the read side — search, filter, and CSV export — on top of it, gated by the existing
`audit.view` permission with the same Management-sees-everything /
Admin-sees-only-their-own-actions split §3.2 already specified.

**Advanced Reports** had no spec beyond a one-line name either, so its scope was picked directly
rather than guessed at: **Clinical & Operational Trends** — `GET /api/reports/trends`, the same
Daily Activity counts but over a date range grouped by day/week/month instead of a single day
(animal-bite visits by exposure category, consultation volume, follow-up completion rate,
appointment no-show/cancellation rates). A data-export toolkit and staff-performance reports were
also on the table and weren't chosen; either is a reasonable follow-up if you want it later.
Still deliberately no revenue/profit figures, matching Daily Activity Reports' restriction.

**Post-launch: the Dashboard landing page was built out.** It was a static "Welcome, {name}"
placeholder with no data since Phase 1 — never wired to anything. It now aggregates today's
snapshot from the modules that already existed: new patients, animal-bite visits, and
consultations (from Daily Activity); today's appointments (row-scoped to a Doctor's own
schedule, same rule as the Appointments page); follow-ups due today/overdue (a new count-only
query, no existing one fit); low-stock/expiring-soon inventory alerts; who's on shift today
(row-scoped to your own shift unless you have `scheduling.manage`); and, for Management, today's
Financial Summary in the same Total Revenue − Total Expenses − Total Cash Disbursement = Net
Profit format as the Financial page. Every section is gated by that section's own existing
permission (`reports.view`, `appointments.view`, `inventory.view`, `scheduling.view`,
`financial.view`) rather than one new blanket permission — a user with none of these still gets
a working dashboard, just with fewer sections, matching how differently each role already sees
the rest of the app. See `backend/README.md` and `frontend/README.md` for the full design.

The **Patient Portal** is, per §1.3, a deliberately separate app from the staff SPA —
[`patient-portal/`](patient-portal/), its own React + Vite project, its own auth flow (a
completely separate `patient_accounts` table and JWT secret pair, not a new role in `users`),
its own public-facing security posture (registration is rate-limited; every request is scoped
server-side to the caller's own patient record, never client-supplied). **v1 is adults only** —
a minor can't legally self-register, and the architecture doc doesn't specify a guardian-account
model, so self-registration is rejected outright for anyone under 18 rather than guessed at; see
`patient-portal/README.md`. Registration never auto-links to an existing (staff-created) patient
record even when a likely duplicate is confirmed — matching name and date of birth are both
guessable facts, and auto-linking on them would let anyone who knows those two things about an
existing patient read their full medical history, a real exposure under the Data Privacy Act
(RA 10173), not a hypothetical one. Building this also surfaced a real pre-existing bug in the
API's routing (several routers mounted at a bare `/api` prefix were unconditionally requiring
staff auth on every request that reached them, invisible until a genuinely public endpoint hit
it) — see `backend/README.md` for the full explanation and fix.

See [`backend/README.md`](backend/README.md) (133 tests), [`frontend/README.md`](frontend/README.md),
and [`patient-portal/README.md`](patient-portal/README.md) for what was actually run and what
each module's browser verification covered. Real bugs and gaps were found and fixed throughout,
not just theoretical risks — the READMEs list them: an env-var leak in the test harness, a
Postgres date-timezone bug, a falsy-zero bug on the actual first rabies vaccine dose, a missing
"own patients" enforcement gap, a `NaN` bug in payment totals, a recurring backend gap — a role
with the permission to *do* something (book an appointment, assign a shift) but no permission to
fetch *who* to do it to — hit twice (doctor listing, staff roster) and, the second time, caught
proactively before it ever broke in the browser, the routing bug above, and — in the Trends
report — the same date-string-not-a-Date-object gotcha the original timezone bug fix caused,
recurring in a new place (a computed `date_trunc(...)::date` column) and this time caught
immediately by the first test run rather than a live smoke test.

Both frontends' `localStorage` token storage remains a flagged production trade-off — see their
READMEs' "Known gaps".

## Layout

```
backend/          Node.js + Express API
frontend/         Staff React SPA
patient-portal/   Patient-facing React SPA (separate app — see docs/clover-architecture.md §1.3)
docs/             Architecture & database design
```
