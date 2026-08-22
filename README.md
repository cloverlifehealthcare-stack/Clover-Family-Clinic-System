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

See [`backend/README.md`](backend/README.md) (103 tests) and
[`frontend/README.md`](frontend/README.md) for what was actually run and what each module's
browser verification covered. Real bugs and gaps were found and fixed throughout, not just
theoretical risks — both READMEs list them: an env-var leak in the test harness, a Postgres
date-timezone bug, a falsy-zero bug on the actual first rabies vaccine dose, a missing "own
patients" enforcement gap, a `NaN` bug in payment totals, and a recurring backend gap — a role
with the permission to *do* something (book an appointment, assign a shift) but no permission to
fetch *who* to do it to — hit twice (doctor listing, staff roster) and, the second time, caught
proactively before it ever broke in the browser.

The frontend's `localStorage` token storage remains a flagged production trade-off — see its
README's "Known gaps".

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA
docs/       Architecture & database design
```
