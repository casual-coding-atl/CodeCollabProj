# CodeCollabProj

Collaboration platform for the Casual Coding Meetup group — browse and join member projects, comment, message, and manage the community.

Built as a single **[TanStack Start](https://tanstack.com/start)** application: server-side rendering, file-based routing, and an in-process API — no separate backend. Data lives in **MongoDB (Atlas)**.

> **Migration note:** this repo was previously a two-part MERN app (a Create-React-App `client/` + an Express `server/`). It has been migrated to one TanStack Start app. The React UI (Material UI + TanStack Query) was carried over; every `/api/*` endpoint is now an in-process TanStack Start server route hitting the same MongoDB. See [`docs/adr/0001-migrate-to-tanstack-start.md`](docs/adr/0001-migrate-to-tanstack-start.md).

## Quick start

```bash
npm install
cp .env.example .env   # then fill in the values (see below)
npm run dev            # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (SSR) on :3000 |
| `npm run build` | Production build (client + server) into `dist/` |
| `npm start` | Run the built server (`server.mjs`) — used in production |
| `npm run typecheck` | `tsc --noEmit` |

## Environment

Server-side env is read from `.env` (auto-loaded via `dotenv`) and by the hosting platform in production:

| Var | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string (Atlas) |
| `JWT_SECRET` | Signs the httpOnly session (access) token |
| `NODE_ENV` | `development` locally; `production` on deploy (enables Secure cookies) |
| `PORT` | Port for the production server (`npm start`); set by the host |
| `VITE_API_URL` | Client API base — defaults to same-origin `/api` |

## Architecture

```
src/
  routes/
    __root.tsx              document shell + providers (QueryClient, MUI theme)
    _main.tsx               app layout (Header/Footer) — pathless
    _main.*.tsx             pages (home, login, projects, profile, members, …)
    admin.tsx, admin.*.tsx  admin layout + pages (role-gated)
    api.<resource>.*.ts     in-process API server routes (auth, projects, users, comments, admin)
  server/
    http.ts                 API helpers: json/error, cookies, session issuing, requireUser/requireRole
    models.ts               Mongoose models (users, sessions, projects, comments, messages)
    db.ts                   cached Mongoose connection
  components/ hooks/ services/ config/ types/ utils/   ported React app (MUI + TanStack Query)
  compat/react-router-shim.tsx   react-router-dom → TanStack Router bridge (migration aid)
```

**Auth:** login validates against `users` (bcrypt), issues a JWT stored in an **httpOnly `accessToken` cookie**, and records a session in `sessions`. The cookie is validated server-side on every request/SSR load — no token touches client JavaScript.

**Data flow:** components → domain hooks (TanStack Query) → services (axios, same-origin `/api`) → in-process server routes → Mongoose → MongoDB.

## Deployment (Railway)

The app is one Node service. Railway config lives in [`railway.json`](railway.json):

- **Build:** `npm run build`
- **Start:** `npm start` (serves the built handler via `server.mjs` on `$PORT`)
- **Env:** set `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production` on the service.

## Known gaps (carried from the original app / not yet wired)

- **Email flows** (password-reset-by-link, email verification) return success shapes but send no email — email verification is currently disabled (new accounts are created verified).
- **Avatar image upload** accepts the request but does not persist the binary (needs object storage).
- A few `/users/:id/*` endpoints (projects, stats, followers, following, follow) are not implemented — they were never implemented in the original backend either.
