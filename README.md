# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 backend is complete** — all six modules (auth/RBAC, patients, Animal Bite Center,
consultations, appointments, billing) are built and verified in [`backend/`](backend/README.md)
against a real database, with a 70-test suite. The frontend (React SPA) hasn't been started yet.
See the backend README for setup and a list of every real bug caught along the way.

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA (not started yet)
docs/       Architecture & database design
```
