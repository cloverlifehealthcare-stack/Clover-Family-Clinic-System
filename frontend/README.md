# Clover Clinic — Staff SPA

React + Vite. Auth & RBAC foundation only — login, session handling, and a permission-gated
shell. Every other module (patients, animal bite, consultations, appointments, billing) has a
working, tested API in `../backend` but no screen here yet; their nav links go to a "coming soon"
placeholder.

**Verified in a real browser against the live API**, not just built: logged in as the seeded
Management account and confirmed all 7 nav items show; created a Nurse account and confirmed
their nav shows only the 5 items their permissions actually cover (no Billing, no Staff
Accounts); confirmed logout returns to `/login`; confirmed navigating a Nurse directly to
`/billing` by URL — not just hiding the link — renders "Access denied" rather than the page,
since the API would reject it anyway (§1.1: the client never decides what's allowed, it only
reflects what the server already permitted).

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

## Known gaps

- **Tokens live in `localStorage`**, not an httpOnly cookie, because the backend's
  `POST /api/auth/login` returns both tokens in the JSON response body — there's no cookie for
  the browser to use instead. That's a real XSS trade-off: anything that can run JS on this page
  can read the tokens. Fine for now; revisit (cookie-based refresh token, at minimum) before this
  handles real patient data in production.
- No build/deploy pipeline yet — `npm run build` produces a static `dist/`, matching the hosting
  proposal in `../docs/clover-architecture.md` §1.3, but nothing wires that up yet.
