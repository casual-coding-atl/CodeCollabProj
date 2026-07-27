# CONTEXT.md — Ubiquitous Language

Glossary of domain terms for CodeCollabProj. Terms only — no implementation details.
Decisions with rationale live in `docs/adr/`.

## Terms

**Member** — A registered user of the platform. Appears in the UI as "member"
(`/members`); stored as a User. Every member has exactly one account.

**Project** — A collaboration listing created by a member (the **Owner**)
seeking collaborators. Has a lifecycle status: planning → in-progress →
completed / on-hold.

**Collaborator** — A member attached to a project with a status of pending,
accepted, or rejected. The owner is not listed as a collaborator.

**Linked Repository** — A GitHub repository attached to a project by its
owner. A project has zero to three linked repositories; the same repository may
be linked to different projects. Only public repositories can be linked.

**Linked GitHub Account** — The GitHub identity a member has connected to
their account via OAuth. A member has at most one linked GitHub account, used
for sign-in, profile enrichment (future), and authenticated GitHub reads. A
GitHub identity is only ever linked to an existing account by connecting it from
the security page while already signed in — a GitHub sign-in whose email matches
an existing account is refused, not auto-merged, so nobody can be walked into an
account they pre-registered someone else's email for. A member who signs in with
GitHub and is new here (email not already known) is created on the spot; their
username is derived from their GitHub login, and the new row keeps GitHub's real
email-verified state rather than being marked verified regardless.

**Passkey** — A WebAuthn credential a member registers as an additional way to
sign in, secondary to their primary credentials. A member may have several.
