# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 is complete, backend and frontend.** All six modules — Auth & RBAC, Patients, Animal
Bite Center, Consultations, Appointments, Billing — are built and verified against a real
database and, for the frontend, in a real browser against the live API. See
[`backend/README.md`](backend/README.md) (73 tests) and [`frontend/README.md`](frontend/README.md)
for what was actually run and what each module's browser verification covered.

Real bugs and gaps were found and fixed throughout, not just theoretical risks — both READMEs
list them: an env-var leak in the test harness, a Postgres date-timezone bug, a falsy-zero bug on
the actual first rabies vaccine dose, a missing "own patients" enforcement gap, a `NaN` bug in
payment totals, and two backend gaps (a missing doctor-listing endpoint, appointments with no
patient/doctor names) found only once the frontend actually needed them.

Next up: Phase 2 (inventory, staff scheduling, reminders) per the architecture doc's roadmap, or
hardening what's here — the frontend's `localStorage` token storage is flagged as a real
production trade-off in its README.

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA
docs/       Architecture & database design
```
