# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 backend is complete** — all six modules (auth/RBAC, patients, Animal Bite Center,
consultations, appointments, billing) are built and verified in [`backend/`](backend/README.md)
against a real database, with a 70-test suite.

**Frontend has everything except Billing** — Auth & RBAC, Patients, Animal Bite Center,
Consultations, and Appointments (booking, doctor picker, check-in/complete/cancel/no-show,
reschedule, double-booking rejection), all verified in a real browser against the live API (see
[`frontend/README.md`](frontend/README.md)). Two real backend gaps were found and fixed while
building Appointments: Admin couldn't fetch the doctor list, and appointment responses had no
patient/doctor names. Only the Billing screen is left — its API is ready and waiting.

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA (not started yet)
docs/       Architecture & database design
```
