/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROTOTYPE — THROWAWAY CODE. Do not ship.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Question this prototype answers: how should Meetup-verified project
 * creation feel end-to-end? (Design approach A: permission gate + pluggable
 * verifier + link flow. Real Meetup OAuth needs a Meetup Pro subscription and
 * an approved API consumer — status unconfirmed — so "Sign in with Meetup" is
 * simulated by picking a fake identity, and the membership check answers from
 * the table below instead of Meetup's GraphQL API.)
 *
 * Grants live in memory: restarting the dev server wipes them. Nothing here
 * writes to the database.
 *
 * To remove the prototype entirely, delete:
 *   - this file and meetup-prototype.NOTES.md
 *   - src/routes/api.prototype.meetup*.ts
 *   - src/components/prototype/MeetupVerifyCard.tsx
 *   - the two hunks marked PROTOTYPE(meetup-gate):
 *       api.projects.ts POST gate, auth.ts newMemberDefaults permissions
 *   - the _main.projects.create.tsx wrapper
 */

export interface FakeMeetupAccount {
  meetupId: string;
  label: string;
  /** What the real GraphQL `groupByUrlname(urlname:"casual-coding").isMember` would say. */
  inGroup: boolean;
}

export const FAKE_MEETUP_ACCOUNTS: FakeMeetupAccount[] = [
  { meetupId: 'mu-1001', label: 'alex_atl — Casual Coding member since 2024', inGroup: true },
  { meetupId: 'mu-1002', label: 'jordan_dev — joined Casual Coding last week', inGroup: true },
  { meetupId: 'mu-2001', label: 'stranger99 — has a Meetup account, not in the group', inGroup: false },
];

export interface MeetupGrant {
  meetupId: string;
  label: string;
  verifiedAt: string;
}

/** userId → grant. In-memory on purpose (prototype rule: no persistence). */
const grants = new Map<string, MeetupGrant>();

export function grantFor(userId: string): MeetupGrant | null {
  return grants.get(userId) ?? null;
}

/**
 * The whole "callback" of the simulated OAuth dance: look the identity up,
 * run the membership check, grant on success. The shape of the refusal is
 * the part worth prototyping — it's what a real non-member would see.
 */
export function linkAndVerify(
  userId: string,
  meetupId: string
): { ok: true; grant: MeetupGrant } | { ok: false; reason: string } {
  const account = FAKE_MEETUP_ACCOUNTS.find((a) => a.meetupId === meetupId);
  if (!account) return { ok: false, reason: 'Unknown Meetup account.' };
  if (!account.inGroup) {
    return {
      ok: false,
      reason:
        'That Meetup account is not a member of Casual Coding. Join the group on Meetup (it is free), then verify again.',
    };
  }
  const grant: MeetupGrant = {
    meetupId: account.meetupId,
    label: account.label,
    verifiedAt: new Date().toISOString(),
  };
  grants.set(userId, grant);
  return { ok: true, grant };
}

export function resetGrant(userId: string): void {
  grants.delete(userId);
}
