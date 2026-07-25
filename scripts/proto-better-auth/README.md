# PROTOTYPE — Better Auth migration feasibility (throwaway)

**Question:** Can Better Auth's MongoDB adapter run against our *existing*
`users` collection shape — legacy bcrypt hashes preserved via custom
`password.{hash,verify}`, `users` mapped as the user model, a migration that
moves hashes into `account` rows — such that sign-in, sessions, and our custom
suspension guard all work? (This is the core bet of Phase 1 in
`docs/superpowers/specs/2026-07-24-github-integration-design.md`.)

**Run:** `npm run proto:auth`
(needs local mongod; uses scratch DB `proto_better_auth_WIPEME` — safe to drop
any time, override with `PROTO_MONGODB_URI`)

Drive it with single keys: seed a legacy-shaped user, run the migration,
sign in with the original password, inspect the session, flip suspension and
watch the guard deny. The full DB state renders after every action.

- `auth-core.mjs` — the portable part: Better Auth config factory + migration
  + session guard. If the prototype validates, THIS shape gets rewritten
  properly (in TS) into `src/server/auth.ts` + the migration script.
- `index.mjs` — throwaway TUI shell. Never ships.

## NOTES — ANSWERED 2026-07-24 (headless run of the same core)

- [x] Sign-in with legacy bcrypt hash after migration: **works** (200, session
      cookie issued; wrong password → 401).
- [x] `users` collection mapping: **works** — Better Auth read/wrote our
      existing collection via `user.modelName: 'users'`; ObjectId ids preserved.
- [x] Suspension guard over `getSession`: **works** — session stays valid,
      guard denies with reason `suspended`, exactly mirroring getAuthUser.
- [x] Surprises for the real migration script: legacy users lack
      `name`/`emailVerified`/`updatedAt` — migration must backfill them
      (`name` ← `username`, `emailVerified` ← `isVerified`) or sign-in works
      but the user object is malformed. Also: keep the credential `account`
      row's `accountId` = user id string, `providerId: 'credential'`.

**Verdict: Phase 1's approach is feasible as designed.** `auth-core.mjs` is
the reference shape for `src/server/auth.ts`. Delete this directory once
Phase 1 lands.
