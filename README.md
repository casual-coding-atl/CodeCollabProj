# CodeCollabProj

**[https://github.com/casual-coding-atl/CodeCollabProj](https://github.com/casual-coding-atl/CodeCollabProj)**

Collaboration platform for the Casual Coding Meetup group — browse and join member projects, comment, message, manage the community, and get AI-powered evaluations of your project ideas.

Built as a single **[TanStack Start](https://tanstack.com/start)** application: server-side rendering, file-based routing, and an in-process API — no separate backend. Data lives in **MongoDB (Atlas)**. Auth is handled by **[Better Auth](https://better-auth.com)** with password, passkey (WebAuthn), and GitHub OAuth support.

## Quick start

```bash
npm install
cp .env.example .env   # fill in the values — see Environment section below
npm run dev            # http://localhost:3000
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server (SSR) on :3000 |
| `npm run build` | Production build (client + server) into `dist/` |
| `npm start` | Run the built server (`server.mjs`) — used in production |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test:unit` | Vitest unit test suite |
| `npm run test:e2e` | Playwright end-to-end suite (requires MongoDB + built server) |
| `npm run migrate:auth` | One-off Better Auth migration for existing user accounts |

## Environment

Copy `.env.example` to `.env` and fill in the values. Server-side env is auto-loaded via `dotenv`; the hosting platform supplies them in production.

| Var | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string (Atlas or local) |
| `BETTER_AUTH_SECRET` | ✅ | Signs sessions and tokens — use a long random value |
| `BETTER_AUTH_URL` | Production only | App's own origin — required in production, defaults to `http://localhost:3000` in dev |
| `NODE_ENV` | ✅ | `development` locally; `production` on deploy (enables Secure cookies) |
| `PORT` | Host-set | Port for the production server; set automatically by Railway |
| `VITE_API_URL` | — | Client API base — defaults to same-origin `/api` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional | GitHub OAuth app — enables "Sign in with GitHub". Callback URL: `${BETTER_AUTH_URL}/api/auth/callback/github` |
| `GITHUB_TOKEN` | Optional | Server-side fallback token for GitHub API reads (repo cards, linking). Must be a fine-grained token with **no scopes beyond public repos** |
| `RESEND_API_KEY` / `EMAIL_FROM` | Optional | Outbound email via [Resend](https://resend.com) — enables real password-reset emails |
| `ANTHROPIC_API_KEY` | Optional | Enables the AI-powered project evaluation feature. Without it the Evaluation tab is visible but returns 503. Get a key at [console.anthropic.com](https://console.anthropic.com) |
| `JWT_SECRET` | Legacy fallback | Honoured as a fallback for `BETTER_AUTH_SECRET` so existing deployments keep booting |

## Architecture

```
src/
  routes/
    __root.tsx              document shell + providers
    _main.tsx               app layout (Header/Footer) — pathless
    _main.*.tsx             pages (home, projects, profile, members, security, …)
    admin.tsx, admin.*.tsx  admin layout + pages (role-gated)
    api.<resource>.*.ts     in-process API server routes
  server/
    auth.ts                 Better Auth configuration (password, passkey, GitHub OAuth)
    claude.ts               Anthropic Messages API wrapper (evaluation feature)
    evaluation-staleness.ts Pure abandonment-rule decision (Issue #93)
    github.ts               GitHub API reads (repo linking, repo cards)
    github-cache.ts         MongoDB-backed GitHub response cache
    http.ts                 API helpers: json/error, requireUser/requireRole
    models.ts               Mongoose models
    db.ts                   Cached Mongoose connection
    email.ts                Resend outbound email (password reset)
    notifications.ts        SSE-based real-time notification delivery
  components/ hooks/ services/ config/ types/ utils/
  prompts/agentic-evaluation/   Claude prompt templates
```

**Auth:** [Better Auth](https://better-auth.com) manages sessions via an httpOnly cookie. Members can sign in with email/password, a passkey (WebAuthn), or GitHub OAuth. GitHub OAuth can also be linked to an existing account from `/security`.

**Data flow:** components → domain hooks (TanStack Query) → services (axios, `/api`) → in-process server routes → Mongoose → MongoDB.

## Features

### Projects
Browse, create, and manage software project ideas. Filter by status, technology, and tags. Request or accept collaboration on projects.

### GitHub Repository Linking
Project owners can link up to 3 public GitHub repositories to a project. Linked repos display live cards (stars, language, description) sourced from the GitHub API with a MongoDB-backed cache.

### Agentic Evaluation Framework
Project owners can request an AI-powered evaluation of their project idea (Phase 1: Ideation). The evaluation assesses the submitted README across six dimensions:

1. Clarity of Intent
2. Scope & Prioritisation Realism
3. User Need Validation
4. Feasibility Assessment
5. Completeness of Vision
6. Differentiation

When linked repositories are present a **Reality Check** dimension is added, comparing the pitch against actual repository evidence. Results include a readiness score (1–5), per-dimension findings, action items, and a **Mermaid flowchart** of the project's core user journey.

Up to 3 evaluations are retained per project (rolling window). Requires `ANTHROPIC_API_KEY`.

### Messaging & Notifications
Direct member-to-member messaging. Real-time notifications (SSE) for collaboration requests, acceptances, and comments.

### Admin Panel
Role-gated admin dashboard: user management, suspension, role assignment, and activity logs.

## Deployment (Railway)

The app is one Node service. Config lives in [`railway.json`](railway.json):

- **Build:** `npm run build`
- **Start:** `npm start` (serves via `server.mjs` on `$PORT`)
- **Required env:** `MONGODB_URI`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NODE_ENV=production`
- **Optional env:** `ANTHROPIC_API_KEY`, `GITHUB_CLIENT_ID`/`SECRET`, `GITHUB_TOKEN`, `RESEND_API_KEY`/`EMAIL_FROM`

## Testing

```bash
npm run test:unit   # Vitest — pure unit tests, no DB or network
npm run test:e2e    # Playwright — full stack against a dedicated E2E database
```

The E2E suite stubs both the GitHub API and the Anthropic API with local fixtures so no live network calls or API credits are needed.

## Known gaps

- **Avatar image upload** accepts the request but does not persist the binary (needs object storage).
- A few `/users/:id/*` endpoints (stats, followers, following, follow) are not implemented — they were never implemented in the original backend either.
