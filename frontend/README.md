# Clover Clinic — Staff SPA

React + Vite. Auth & RBAC foundation, plus a working Patients module (list/search, create with
duplicate-warn and minor/guardian handling, view, edit). The remaining four modules (animal bite,
consultations, appointments, billing) have working, tested APIs in `../backend` but no screens
here yet; their nav links go to a "coming soon" placeholder.

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

## Known gaps

- **Tokens live in `localStorage`**, not an httpOnly cookie, because the backend's
  `POST /api/auth/login` returns both tokens in the JSON response body — there's no cookie for
  the browser to use instead. That's a real XSS trade-off: anything that can run JS on this page
  can read the tokens. Fine for now; revisit (cookie-based refresh token, at minimum) before this
  handles real patient data in production.
- No build/deploy pipeline yet — `npm run build` produces a static `dist/`, matching the hosting
  proposal in `../docs/clover-architecture.md` §1.3, but nothing wires that up yet.
