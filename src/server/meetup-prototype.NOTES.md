# PROTOTYPE NOTES — Meetup-gated project creation

**Question:** How should "only Casual Coding meetup members can create
projects" work end-to-end? (Design approach A from the 2026-07-25
brainstorm: enforce the existing-but-unenforced `project:create` permission,
grant it through a pluggable membership verifier, prompt unverified members
to verify right where they hit the wall.)

**What's real in this prototype**

- The gate: `POST /api/projects` now refuses (403 `MEETUP_MEMBERSHIP_REQUIRED`)
  unless the member has `project:create` or a prototype grant.
- New signups no longer get `project:create` stamped (the grandfathering
  flip — existing members keep whatever their row already has).
- The unverified UX: `/projects/create` shows the verify prompt instead of
  the form; verifying swaps the form in without leaving the page.

**What's faked**

- "Sign in with Meetup" is an identity picker (3 canned accounts), because a
  real OAuth consumer requires Meetup Pro (unconfirmed). The membership check
  answers from a table instead of `groupByUrlname(...).isMember`.
- Grants are in-memory (restart wipes them) — the real design writes
  `project:create` into `user.permissions` plus a verification record.

**Run it:** `npm run dev`, register a fresh account, go to /projects/create.

**Verdict** (2026-07-25, after demo + UX pass + Codex review):
- Flow feels right? — Yes ("the ui is close"). Viewing stays public; the gate
  touches creation only.
- Meetup Pro confirmed by organizer? — Still open. Blocks the OAuth verifier
  only; gate + backfill + admin override ship regardless.
- Anything to change before the real build? — Canonical permission name is
  `projects.create` with a backfill (naming split found in review); linking
  goes through better-auth's generic-oauth `POST /oauth2/link` with
  `disableSignUp: true`; verification gets a freshness TTL. Full spec:
  docs/superpowers/specs/2026-07-25-meetup-gated-project-creation-design.md
