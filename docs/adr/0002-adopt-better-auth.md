# 0002 — Adopt Better Auth for authentication

**Date:** 2026-07-24
**Status:** Accepted

## Context

Auth is hand-rolled in `src/server/http.ts` + ~13 `api.auth.*` routes: bcrypt
passwords, a JWT access cookie, and a custom `sessions` collection. The
product direction adds OAuth (GitHub account linking now, sign-in-with-GitHub
later) and passkeys. Hand-rolling OAuth on the existing plumbing means
building state/CSRF handling, token exchange, and account-linking logic
ourselves — and rebuilding it anyway if we ever adopt an auth framework.

Alternatives considered:

- **Hand-rolled GitHub OAuth** (two endpoints, no deps): cheapest now, but
  throwaway once a framework arrives, and every future method (passkeys, more
  providers, 2FA) is another hand-rolled subsystem.
- **`arctic` (OAuth client library):** saves the token-exchange boilerplate
  only; sessions, linking, and passkeys remain ours to build.
- **GitHub App instead of OAuth App:** fine-grained permissions and higher
  rate limits, but adds installation flows and private-key management —
  overkill for public-repo reads and identity.

## Decision

Adopt **Better Auth** with the MongoDB adapter as the auth layer:

- One catch-all route (`api.auth.$.ts`) replaces the hand-written auth routes.
- Existing bcrypt hashes are preserved via custom `password.{hash,verify}` —
  no user password resets.
- The existing `users` collection is mapped as Better Auth's user model, so
  all ObjectId references from projects/comments/messages survive.
- `requireUser`/`requireRole` keep their signatures; internals swap to
  `auth.api.getSession`. Roles/suspension stay custom fields enforced there
  (Better Auth's admin plugin deliberately NOT adopted for now).
- Plugins: passkey now; GitHub social provider in the next phase.

## Consequences

- OAuth linking, sign-in-with-GitHub, passkeys, and future methods (2FA,
  magic links) become configuration + UI rather than subsystems.
- New collections (`account`, `session`, `verification`, `passkey`); a one-off
  migration script creates credential accounts from existing hashes; the
  legacy `sessions` collection is retired and **all users are logged out once**.
- The client auth service/hooks must be rewritten over `better-auth/react`.
- Users' GitHub OAuth tokens will be stored server-side in `account` rows —
  standard for OAuth-linking apps, but the DB now holds third-party tokens.
- We take a dependency on Better Auth's release cadence for security fixes;
  in exchange we delete our bespoke JWT/session code.
