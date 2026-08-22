# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 is complete, backend and frontend.** All six modules — Auth & RBAC, Patients, Animal
Bite Center, Consultations, Appointments, Billing — are built and verified against a real
database and, for the frontend, in a real browser against the live API.

**Phase 2 is underway — Inventory is done.** Unlike Phase 1, the architecture doc has no detailed
schema for Phase 2 modules (§2 just names them); Inventory's design was worked out inline while
building it, flagged clearly in the migration comments and both READMEs rather than presented as
a transcribed spec. It's optionally wired into Animal Bite Center: administering a dose or RIG
against a tracked batch decrements stock automatically. Follow-up reminders (needs real Globe/
Gmail credentials — will be built as a pluggable stub until those exist) and staff scheduling
aren't started yet.

See [`backend/README.md`](backend/README.md) (84 tests) and
[`frontend/README.md`](frontend/README.md) for what was actually run and what each module's
browser verification covered. Real bugs and gaps were found and fixed throughout, not just
theoretical risks — both READMEs list them: an env-var leak in the test harness, a Postgres
date-timezone bug, a falsy-zero bug on the actual first rabies vaccine dose, a missing "own
patients" enforcement gap, a `NaN` bug in payment totals, and backend gaps (missing doctor-listing
endpoint, appointments with no patient/doctor names) found only once the frontend actually needed
them.

The frontend's `localStorage` token storage remains a flagged production trade-off — see its
README's "Known gaps".

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA
docs/       Architecture & database design
```
