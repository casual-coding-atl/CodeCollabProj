# GitHub Integration — Design

**Date:** 2026-07-24
**Status:** Approved pending user review
**Related:** ADR 0002 (adopt Better Auth), `CONTEXT.md` glossary

## Overview

Bring GitHub into CodeCollabProj in three shippable phases:

1. **Better Auth migration** — replace the hand-rolled JWT/session auth with
   Better Auth (email/password preserved, passkeys added). No GitHub yet.
2. **GitHub foundation** — GitHub account linking, project↔repo linking
   (public repos, max 3, owner-only), repo cards, server-side GitHub proxy +
   cache.
3. **GitHub delight** — create-project-from-repo, merged activity feed,
   member-profile enrichment.

Out of scope (deliberately deferred): sign-in-with-GitHub (future phase 4 —
becomes configuration once phases 1–2 exist), GitHub webhooks → notifications,
private repos.

## Phase 1 — Better Auth migration

### What changes

- **New dependency:** `better-auth` + `@better-auth/mongo-adapter`, configured
  in `src/server/auth.ts`. Plugins: `passkey`. Admin plugin NOT adopted —
  roles/suspension stay custom (see "What stays").
- **Routes:** the ~13 `src/routes/api.auth.*.ts` files are replaced by one
  catch-all `src/routes/api.auth.$.ts` delegating GET/POST to
  `auth.handler(request)`.
- **Passwords:** existing bcrypt hashes (bcryptjs, cost 12) are kept.
  `emailAndPassword.password.{hash,verify}` is overridden with bcryptjs so no
  user resets a password.
- **Collections:** the existing `users` collection is mapped as Better Auth's
  user model (model/field-name mapping), preserving every
  `Project.owner` / `collaborators.userId` ObjectId reference. New collections:
  `account` (credential + future OAuth accounts), `session` (Better Auth's),
  `verification`, `passkey`. The legacy `sessions` collection is retired —
  all users log in once more after deploy.
- **Migration script** (one-off, idempotent): for each user with a `password`
  field, create a credential `account` row referencing that hash; map field
  names Better Auth expects (`emailVerified`, `createdAt`, …). `username`
  becomes an additional field (login stays email-only; no username plugin).
- **`src/server/http.ts`:** `requireUser`/`requireRole` keep their signatures.
  Internally they call `auth.api.getSession({ headers })`, then load the
  Mongoose user doc and enforce `isActive` / `isSuspended` / `suspendedUntil`
  exactly as today. `issueSession`, `setAuthCookies`, JWT code are deleted.
- **Client:** the axios `authService` + auth hooks (login, register, logout,
  logout-all, change-password, password reset, sessions list) are rewritten
  over `better-auth/react`'s client. Pages keep their look; the sessions page
  uses `listSessions`/`revokeSession(s)`. Passkey registration UI is added to
  the profile/security page.
- **Email flows:** `sendResetPassword` / verification callbacks are wired to
  the existing stubs (email sending remains a known gap).

### What stays

`role`, `permissions`, `isActive`, `isSuspended`, `suspendedUntil` remain
plain fields on the user doc, enforced in `requireUser`. The admin panel and
all 6 `api.admin.*` endpoints are untouched. Adopting Better Auth's admin
plugin is a possible later project with zero throwaway cost.

### Config

- `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` (`http://localhost:3000` dev,
  `https://codecollabproj.com` prod).
- Passkey relying-party ID: `localhost` (dev) / `codecollabproj.com` (prod).

## Phase 2 — GitHub foundation

### Account linking

- GitHub configured as a Better Auth social provider (OAuth App, scopes
  `read:user user:email` only). Profile page gains "Connect GitHub" →
  `authClient.linkSocial({ provider: 'github' })`; the GitHub identity and
  access token land on the member's `account` row. Unlink supported.
- Two GitHub OAuth Apps (user creates, ~2 min each): dev → callback
  `http://localhost:3000/api/auth/callback/github`; prod →
  `https://codecollabproj.com/api/auth/callback/github`. Env:
  `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` per environment.

### Repo linking

- `Project` schema gains
  `linkedRepos: [{ repoId: Number, owner: String, name: String, linkedAt: Date }]`
  (max **3**, enforced server-side). `repoId` (GitHub's numeric id) survives
  renames; `owner/name` refreshed from API responses when they drift.
- Endpoints (owner-only, via `requireUser` + ownership check):
  - `POST /api/projects/$id/repos` — body `{ owner, name }` or a GitHub URL;
    validated against GitHub (must exist, must be public) before saving.
  - `DELETE /api/projects/$id/repos/$repoId`.
- Edit-project page gains a "Linked repositories" section (add by URL,
  remove). Unlinking a GitHub *account* never unlinks project repos.

### GitHub proxy + cache

All GitHub reads go through server routes — tokens never reach the browser.

- `GET /api/github/repos/$owner/$name` — card data (stars, primary language,
  description, last push, open issues count, archived/404 state).
- Upstream auth fallback chain: requesting user's linked GitHub token
  (5,000 req/hr per user) → optional server `GITHUB_TOKEN` env var →
  unauthenticated (60 req/hr).
- Cache: `github_cache` Mongo collection, key = normalized GitHub API path,
  TTL index. TTLs: repo card & activity **10 min**, languages **1 hr**. Cache
  is shared across users (public data only). On upstream rate-limit or error,
  serve stale cache when present.

### Repo cards

Project page renders one card per linked repo (≤3). A deleted/private repo
shows an "unavailable" state on its card; the page never errors because of a
repo. Logged-out visitors see cards too (server fallback chain).

## Phase 3 — GitHub delight

### Create project from repo

- On `/projects/create`: "Import from GitHub" offering **both** a picker of
  the member's public repos (`GET /api/github/my-repos`, requires linked
  account) **and** a paste-a-URL input (works for anyone, any public repo).
- Prefills title (repo name), description, technologies (repo languages +
  topics). The source repo becomes the project's first linked repo. Everything
  remains editable before submit.

### Activity feed

- `GET /api/github/repos/$owner/$name/activity` per linked repo (GitHub repo
  events API), merged across the project's repos, sorted by time, filtered to
  meaningful events (pushes, PRs opened/merged, releases; bot/star noise
  dropped). Latest **15** shown on the project page with per-repo labels.
  10-minute cache per repo.

### Member profile enrichment

- `/members/$id` shows, for members with a linked GitHub account: GitHub
  username/avatar chip linking to their GitHub profile, plus a "top languages"
  strip computed server-side from their public repos (cached 1 hr). Members
  without a linked account: section absent.

## Error handling summary

- Repo deleted/private after linking → card/feed show "unavailable"; link may
  be removed by the owner.
- GitHub token revoked → silently degrade down the fallback chain.
- Rate-limited upstream → serve stale cache; if no cache, cards show a
  "temporarily unavailable" state.
- Linking a repo that fails validation (404/private/>3) → 4xx with message,
  surfaced in the edit UI.

## Testing

- **Unit (vitest, existing pattern):** cache TTL/read-through logic, activity
  merge+filter, repo URL parsing/validation, `requireUser` suspension
  enforcement over a mocked `getSession`.
- **GitHub API mocked** in all tests (fetch-level fixtures); no live calls.
- **E2E:** existing auth E2E flows updated to Better Auth endpoints
  (login/register/logout/sessions); a smoke for link-repo → card renders.
- Migration script tested against a copy of the dev database before prod.

## Rollout notes

- Phase 1 deploy logs every user out once (legacy sessions retired) — an
  acceptable, communicated one-time event.
- Migration script runs before the phase-1 deploy; legacy `sessions`
  collection dropped after verification.
