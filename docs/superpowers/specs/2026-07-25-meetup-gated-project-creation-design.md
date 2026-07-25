# Meetup-Gated Project Creation — Design

2026-07-25. Validated by prototype (`prototype/meetup-gated-projects`, see
`src/server/meetup-prototype.NOTES.md`) and a Codex design review of it.

## Problem

Anyone who registers can create projects. Project creation should be limited
to members of the Casual Coding meetup group — while **viewing stays public**:
browsing projects, project pages, and comments are unchanged. The gate exists
at exactly one point: creating a project.

## Decisions (made during brainstorm, confirmed on the prototype)

- **Trust level:** real Meetup verification, with the verifier behind a seam
  so it can be swapped (Meetup Pro availability is still unconfirmed).
- **Grandfathering:** everyone with an account before the gate ships keeps
  creation rights. Only post-gate signups must verify.
- **Unverified UX:** the Create Project page shows a "verify your membership"
  card in place of the form; verifying swaps the form in on the same page
  (prototyped, screenshots in the session's test report).

## Architecture — three layers

### 1. The permission gate

- **Canonical permission: `projects.create`** — the spelling already in the
  typed `Permission` union and the admin role route. The signup default's
  `project:create` (colon) was a divergent spelling; the prototype review
  surfaced the split (dev DB: 2 colon / 1 dot / 15 neither).
- `requirePermission(request, permission)` helper in `src/server/http.ts`
  beside `requireUser`; `POST /api/projects` uses it and answers
  `403 { code: 'MEETUP_MEMBERSHIP_REQUIRED' }` when it fails.
- **Backfill migration** (one-off, like `migrate:auth`): every existing user
  gets `projects.create` added (grandfather); rows carrying the colon
  spelling are rewritten to the dot spelling. Also backfills any account
  created while the prototype branch was live.
- `newMemberDefaults` stops granting the permission to new signups — this
  flip ships in the same release as the backfill, never separately.
- **Role changes must not erase eligibility**: the admin role route
  overwrites `permissions` wholesale today; it must preserve
  `projects.create` if the member holds a valid verification or grandfather
  status. Eligibility source is stored separately (layer 3's record), so the
  permission can always be recomputed.

### 2. Meetup linking (Better Auth generic-oauth)

- Server: `genericOAuth` plugin with a `meetup` provider — registered only
  when `MEETUP_CLIENT_ID` + `MEETUP_CLIENT_SECRET` are present (mirrors the
  GitHub provider). `disableSignUp: true`: Meetup is evidence of membership,
  never an identity — it cannot create accounts or sign members in.
  Authorization/token URLs: `https://secure.meetup.com/oauth2/authorize`,
  `https://secure.meetup.com/oauth2/access`.
- Client: the verify card's real button is
  `authClient.oauth2.link({ providerId: 'meetup', callbackURL: '/projects/create' })`
  (generic-oauth's `POST /oauth2/link` — the signed-in linking flow, same
  shape as GithubAccountCard's `linkSocial`).
- Better Auth's account model already enforces one Meetup account ↔ one user,
  closing the "one member verifies unlimited accounts" hole.
- The OAuth return path is a full-page redirect (not the prototype's instant
  swap): `callbackURL=/projects/create`, and the create page re-checks status
  on load, so returning lands the member on the unlocked form. Cancellation
  or error at Meetup returns with `?error=` handled like the GitHub sign-in
  error leg.

### 3. Verification records (`src/server/meetup.ts` + `meetup_verification`)

- `meetupRequest()` — the single outbound edge to Meetup's GraphQL API
  (`MEETUP_API_BASE` override for tests/fixtures, like `GITHUB_API_BASE`).
- After linking, one query: `groupByUrlname(urlname: $group) { isMember }`
  with `MEETUP_GROUP_URLNAME` (default `casual-coding`).
- Result recorded: `{ userId, meetupMemberId, isMember, checkedAt }`.
  `isMember: true` grants `projects.create`.
- **Freshness:** verification is not permanent. On a create attempt where the
  record is older than 30 days, re-check with the stored token before
  honouring the permission; a failed re-check (left the group, revoked token)
  removes the permission and the create page shows the verify card again.
  Grandfathered members are exempt (their eligibility source is
  `grandfathered`, not `meetup`).
- **Admin override:** grant/revoke in the admin users panel writes an
  eligibility record with source `admin` — the manual escape hatch for edge
  cases regardless of verifier.

## Feasibility gate (before building layer 2/3)

Meetup's API requires the group to hold **Meetup Pro** to create an OAuth
consumer, approval is not guaranteed, and access dies if Pro lapses. Before
implementing the OAuth verifier: confirm Pro with the organizer, obtain the
consumer, and prove the exact membership query against the live schema (it
changed Feb 2025). **Fallback if Pro falls through:** layers 1 and the
admin-override path ship unchanged; the self-serve verifier becomes an
access code announced at meetups (records source `code`), swappable for
OAuth later.

## UX (validated by prototype)

- Create page **fails closed**: status-check errors show the card with retry,
  never the form.
- Refusal states offer actions (open the group on Meetup / try again).
- A staged progress state covers the OAuth round-trip; success lands visibly
  before the form appears, then a dismissible confirmation strip.
- The projects list's "New Project" button stays visible for everyone —
  discovery over concealment (decided: prompt-to-verify, not hide).

## Security invariants

- Enforcement is server-side only; the client gate is UX.
- The 403 body never reveals whether a *specific* Meetup account is in the
  group beyond the requester's own check.
- Verification endpoints live under Better Auth (its CSRF/origin handling);
  no bespoke cookie-authenticated mutations.
- One Meetup account verifies at most one app account (Better Auth account
  uniqueness).
- Suspension still wins: `requirePermission` composes with the existing
  `getAuthUser` access checks.

## Testing

- Unit: permission decisions, backfill transform, verification-record
  freshness logic, membership-answer classification (mirror
  `github.test.ts` style — pure decisions + one stubbed fetch edge).
- Update `auth.test.ts` `newMemberDefaults` expectations with the flip.
- E2E: fixture Meetup API server (like the GitHub fixture) — member and
  non-member paths through the real UI; gate lifecycle (403 → link →
  201 → revoke → 403).

## Rollout

1. Ship layer 1 + backfill + admin override (complete, shippable gate).
2. Feasibility gate: Meetup Pro + consumer + live query proof.
3. Ship layers 2–3 (or the access-code fallback).
4. Delete the prototype branch; backfill accounts created during it.

## Open questions

- Meetup Pro: has the group got it / will it pay? (Blocks layers 2–3 only.)
- Verification TTL: 30 days is a starting point — organizer may prefer
  event-season alignment.
