# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A single **TanStack Start** app (SSR + file-based routing + in-process API) backed by **MongoDB/Mongoose**. It was migrated from a two-part MERN app (CRA `client/` + Express `server/`), both now removed. See `docs/adr/0001-migrate-to-tanstack-start.md`.

## Commands

```bash
npm run dev        # dev server (SSR) on :3000
npm run build      # production build -> dist/
npm start          # run built server (server.mjs) on $PORT
npm run typecheck  # tsc --noEmit
```

## Architecture

- **Routes** (`src/routes/`): file-based.
  - `__root.tsx` — HTML document + providers (TanStack Query, MUI theme, CssBaseline).
  - `_main.tsx` — pathless layout wrapping pages in `<Layout>` (Header/Footer).
  - `_main.*.tsx` — pages; guarded pages wrap the component in `<PrivateRoute>`.
  - `admin.tsx` + `admin.*.tsx` — admin layout gated by `<AdminRoute requireRole={['admin']}>`.
  - `api.<resource>.*.ts` — **in-process API**. Each file is `createFileRoute('/api/...')({ server: { handlers: { GET, POST, ... } } })`.
- **Server layer** (`src/server/`):
  - `http.ts` — API helpers. Use `handler()` to wrap every route handler; `json()`/`error()` for responses; `requireUser(request)` / `requireRole(request, roles)` for auth; `query(request)` for search params.
  - `auth.ts` — the Better Auth instance (`await getAuth()`); sessions, cookies and every `/api/auth/*` endpoint live there.
  - `github.ts` — everything GitHub: parsing a pasted repo link, the three-repo cap, the token fallback chain (member's linked token → `GITHUB_TOKEN` → unauthenticated) and `githubRequest()`, the single outbound edge to api.github.com. Decisions there are pure and unit-tested.
  - `github-cache.ts` — the cached read path in front of `githubRequest()`: the `github_cache` collection, the read-through decisions and the repo-card payload the proxy answers with. Wrap `githubRequest`; never call `fetch` to GitHub anywhere else.
  - `models.ts` — Mongoose models (`User`, `Session`, `Project`, `Comment`, `Message`, `GithubCache`), `strict:false`, bound to the real collections.
  - `db.ts` — `connectDB()` cached connection. Call it in handlers before querying.
- **Ported React app**: `components/`, `hooks/` (TanStack Query, by domain), `services/` (axios → same-origin `/api`), `config/`, `types/`, `utils/`.
- **Routing is 100% `@tanstack/react-router`.** The old `react-router-dom` compat shim was removed — import `Link`, `useNavigate`, `useParams`, `useSearch`, `Navigate`, `Outlet` from `@tanstack/react-router` directly. Dynamic nav is typed: `navigate({ to: '/projects/$projectId', params: { projectId: id } })`, `<Link to="/members/$id" params={{ id }}>`, `hash={}` / `search={}` for fragments and query.

## Auth model

- **Better Auth** (`src/server/auth.ts`, ADR 0002) owns sessions and cookies. Every `/api/auth/*` endpoint is served by the single splat route `src/routes/api.auth.$.ts` delegating to `auth.handler(request)` — sign-in/up/out, session listing + revocation, password change/reset, passkeys, OAuth callbacks. Get the instance with `await getAuth()` (lazy: it needs the Mongo `Db` from the shared Mongoose connection).
- The existing `users` collection **is** Better Auth's user model (`user.modelName: 'users'`), so every ObjectId reference from projects/comments/messages survives. Passwords stay bcryptjs cost 12 via a `password.{hash,verify}` override. New collections: `account`, `session`, `verification`, `passkey`; the legacy `sessions` collection is retired.
- **Authorization stays ours.** The rules live in `src/server/access.ts` (`isCurrentlySuspended`, `accessDenialReason`) and are enforced twice: `assertMemberMaySignIn` in a `session.create.before` hook refuses to *mint* a session for a deactivated/suspended member (covers password, passkey and any future OAuth sign-in — without it admin revocation is cosmetic), and `getAuthUser(request)` re-checks on every request so a mid-session suspension bites immediately. `requireUser`/`requireRole` gate endpoints and return hydrated user docs. Better Auth's admin plugin is deliberately not adopted.
- **Usernames are app-owned.** Sign-up requires one; format (3–30, `[a-zA-Z0-9_]`) is enforced by the field's zod `validator.input`, case-insensitive uniqueness by `assertUsernameAvailable` in the user-create hook (`409 { code: 'USERNAME_TAKEN' }`). Better Auth's always-on `POST /update-user` rejects the field entirely (`403 { code: 'USERNAME_CANNOT_BE_UPDATED' }`) — `PUT /api/users/profile` is the only path. New accounts are forced `emailVerified: true` in the same hook (verification is disabled, no sender wired).
- **GitHub is linking-only.** `disableImplicitSignUp` + `disableSignUp` on the provider and `/sign-in/social` in `disabledPaths` (404); `POST /link-social` is unaffected. Undo both when GitHub sign-in is actually wanted.
- Env: `BETTER_AUTH_SECRET` (falls back to `JWT_SECRET`), `BETTER_AUTH_URL` (**required in production** — `getAuth()` throws rather than fall back to `http://localhost:3000` and ship a wrong-origin, non-Secure cookie), optional `PASSKEY_RP_ID`, optional `GITHUB_CLIENT_ID`/`GITHUB_CLIENT_SECRET` (the provider registers only when both are present), optional `GITHUB_TOKEN` (server-side fallback for GitHub API reads), optional `GITHUB_API_BASE` (defaults to `https://api.github.com`; the E2E suite points it at a local fixture server so no test touches GitHub).
- **Linked GitHub Account**: `/security` hosts `GithubAccountCard`, which uses `authClient.linkSocial`/`listAccounts`/`unlinkAccount` (never axios under `/api/auth/*`). Linking only ever attaches an `account` row to the member who is already signed in, so it cannot create a user; `account.accountLinking.allowDifferentEmails` is on because a linked GitHub identity cannot sign anybody in.
- **Linked Repositories**: `Project.linkedRepos` (at most 3, `{ repoId, owner, name, linkedAt }`), attached and removed on the project edit page via `POST /api/projects/$id/repos` and `DELETE /api/projects/$id/repos/$repoId` (owner-only; the repository must exist on github.com and be public). The project page renders them with `LinkedRepoCards` (`useRepoCards` → `githubService` → `GET /api/github/repos/$owner/$name`, which is **public**: `getAuthUser`, not `requireUser`).
- **GitHub reads are cached, two-tier.** `github_cache` is keyed by normalized API path and shared across visitors (public data only). An entry is *fresh* for 10 minutes (`REPO_CARD_FRESHNESS_MS` in `src/types/github.ts`, also the client `staleTime`) but stays *readable* for a day — the TTL index reaps on `expiresAt`, not on freshness — so a rate-limited or unreachable GitHub is served stale rather than failing. Only 2xx and 404 are stored; 403/429/5xx never overwrite good data. The proxy always answers the same union (`ok` / `unavailable` / `temporarily-unavailable`), so a card renders a state and the page never errors.
- One-off migration: `npm run migrate:auth` (needs `MONGODB_URI`; `--dry-run` supported). A default run is **additive** — it reports email/username pathologies, creates indexes, upserts credential rows and backfills fields, but leaves the legacy `password` field alone, so it is safe to run *before* the auth deploy and rollback stays possible. `-- --cleanup` drops that field and must wait until the new sign-in is verified in production. Per-user transform: `src/server/auth-migration.ts`.

## Adding an API endpoint

1. Create `src/routes/api.<resource>.<segments>.ts` (dots = path segments, `$x` = params).
2. `export const Route = createFileRoute('/api/...')({ server: { handlers: { GET: handler(async ({ request, params }) => { await connectDB(); ... return json(data) }) } } })`.
3. Gate with `requireUser`/`requireRole` as needed. Return raw Mongoose docs when the client expects `_id`.

## Conventions / gotchas

- SSR runs on Nitro/unenv, which provides **throwing stubs** for browser globals. Guard browser-only code with `import.meta.env.SSR`, not `typeof window`.
- Import `CssBaseline` (and similar) from the `@mui/material` barrel, not `@mui/material/CssBaseline` — the deep default import resolves to an object under SSR.
- MUI/emotion are bundled into the SSR build (`ssr.noExternal` in `vite.config.ts`) to avoid `ERR_UNSUPPORTED_DIR_IMPORT` in production.
- `src/routeTree.gen.ts` is generated by the TanStack Router vite plugin on dev/build — gitignored, don't edit.

## Known gaps

Email sending (reset/verify) and avatar binary storage are stubbed; email verification is disabled (register creates verified accounts). Some `/users/:id/*` endpoints were never implemented in the original backend and remain absent.

## Agent skills

### Issue tracker

Issues and PRDs live as GitHub issues in `casual-coding-atl/CodeCollabProj` (via the `gh` CLI); external PRs are not a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical label names (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`) — all exist on the repo except `needs-info` (created on first use). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `CONTEXT.md` (created lazily) + `docs/adr/`. See `docs/agents/domain.md`.
