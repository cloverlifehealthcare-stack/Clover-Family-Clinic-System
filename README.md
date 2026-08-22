# Clover Clinic Management System

Design doc: [`docs/clover-architecture.md`](docs/clover-architecture.md) — architecture, database
schema, RBAC model, and Phase 1–4 module roadmap.

## Status

**Phase 1 backend is complete** — all six modules (auth/RBAC, patients, Animal Bite Center,
consultations, appointments, billing) are built and verified in [`backend/`](backend/README.md)
against a real database, with a 70-test suite.

**Frontend has its Auth & RBAC foundation** — login, session handling, and a permission-gated
shell, verified in a real browser against the live API (see
[`frontend/README.md`](frontend/README.md)). Screens for the other five modules don't exist yet;
their APIs are ready and waiting.

## Layout

```
backend/    Node.js + Express API
frontend/   React SPA (not started yet)
docs/       Architecture & database design
```
