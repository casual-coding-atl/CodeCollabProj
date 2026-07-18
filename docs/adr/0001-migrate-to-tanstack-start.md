# ADR-0001: Migrate to TanStack Start (SSR + server functions), incrementally

- **Status:** Accepted — migration completed
- **Date:** 2026-07-11
- **Deciders:** repo owner

## Outcome (completed)

The migration was carried through to completion rather than left as a long-lived
strangler-fig. The legacy `client/` (CRA) and `server/` (Express) were **removed**;
the TanStack Start app was promoted to the repo root. Every `/api/*` endpoint
(auth, projects, comments, users, messaging, admin) is now an **in-process
TanStack Start server route** reusing the Mongoose models — there is no separate
backend to run. The React UI (Material UI + TanStack Query) was ported verbatim;
routing was bridged with a `react-router-dom` → TanStack Router compat shim.
Auth is httpOnly-cookie session validation shared by SSR and API routes. The
sections below record the original decision and remain accurate as rationale.

## Context

CodeCollabProj is split across a CRA React client (`client/`) talking to an
Express/MongoDB backend (`server/`) over an HTTP API. An architecture review
found the dominant source of friction is a single, hand-maintained **seam — the
HTTP boundary**:

- Every resource is written twice: an Axios service (`client/src/services/*`)
  and an Express route+controller (`server/routes/*`, `server/controllers/*`),
  sharing no types.
- ~450 lines of glue exist only to cross that seam: `client/src/utils/api.ts`
  (axios + 401-refresh interceptor), `tokenEncryption.ts`, ~12 `@deprecated`
  token methods on `authService.ts`, and per-component `_id`→`id` normalization.
- The account-status gate (suspended / deactivated) is copy-pasted across
  `middleware/auth.ts`, both branches of `middleware/rbac.ts`, and the login
  controller.

A throwaway logic prototype (`prototype/tanstack-seam/`) confirmed the seam
collapses cleanly and the composed auth gates every hard case correctly.

## Decision

Migrate to **TanStack Start** (SSR + `createServerFn` server functions +
file-based routing), **incrementally, one resource vertical at a time**, in a
new app at `web/`. Each server function replaces a whole
`{service + route + middleware + controller}` row.

### Auth: reuse the existing session model, modernized (NOT a rewrite)

We choose the **incremental** auth path over adopting a new auth library
(e.g. Better Auth):

- The session already lives in an **httpOnly `accessToken` cookie** (a JWT
  signed with `JWT_SECRET`), so it is readable and validatable entirely
  server-side inside a TanStack Start `createMiddleware().server()`. **No token
  ever reaches client JS** — this is what lets the entire legacy client token
  layer be deleted.
- `web/src/server/auth.ts` reproduces `sessionService.validateSession`
  faithfully (verify JWT → find active session record → load user → gate account
  status) as ESM-native, composable middleware: `authMiddleware` →
  `requireRole(...)` → `requirePermission(...)`, injecting a typed
  `context.user`. The triplicated status gate collapses into one
  `assertAccountUsable`.
- Adopting Better Auth remains a *future* option; it is a larger bet and is
  explicitly out of scope for the initial migration.

### Data + transition strategy (strangler-fig)

- MongoDB/Mongoose stay. `web/` binds ESM Mongoose models to the **same
  collections** the legacy server writes (`users`, `sessions`, `projects`), so
  both apps share data during transition. The legacy `server/models/*` stay
  authoritative for writes not yet migrated.
- DTOs are normalized **once** at the server-function boundary
  (`web/src/server/dto.ts`, `_id`→`id`, owner populated), so client types are
  true and the scattered `getUserId`/`projectId2`/`as unknown as {_id}` casts
  delete.
- SSR is applied **where appropriate**: read-heavy/public pages (projects list &
  detail) get route `loader`s; auth forms stay client-side.

## What has shipped (this ADR's first increment)

The **Projects vertical slice** in `web/`:

- `getProjects`, `getProject`, `createProject` server functions over the real
  `Project` collection, behind `authMiddleware` (+ `requirePermission` on create).
- SSR routes `projects/index.tsx` (list) and `projects/$id.tsx` (detail) via loaders.
- Verified: `vite build` succeeds for **both client and SSR** environments (DB
  code bundled server-only), `tsc --noEmit` passes, `/` SSRs at HTTP 200, and an
  unauthenticated `/projects` is gated **server-side, before any DB call**
  ("not authenticated"), proving the composed auth middleware.

## Consequences

**Positive:** one type surface per resource; the client service layer + axios
interceptor + client token machinery delete as each resource migrates; auth
policy lives in one composable place; SSR gives first-paint content.

**Costs / follow-ups (do NOT let these fall through the seam):**

- Cross-cutting Express middleware — **rate limiting, Helmet/CSP, security
  monitoring** — needs an explicit home in the Start server handler.
- `AuthError.status` is not yet mapped to the HTTP response status in loaders
  (thrown auth errors currently surface as 500 via `errorComponent`); wire a
  status mapping / redirect-to-login before cutover.
- Session **refresh** (the 15-min access-token rotation) still happens on the
  legacy server; the Start app currently only *validates*. Decide whether refresh
  moves into a server function or the shared cookie flow stays.
- Remaining resources (Users, Comments, Admin, Messaging, Auth forms) follow the
  same pattern; migrate one vertical at a time and delete the retired
  `service`/`route`/`controller` trio per resource.
