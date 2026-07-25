/**
 * The app's own account rules, kept apart from both Better Auth and the HTTP
 * layer so either can ask the same question without importing the other.
 *
 * Better Auth answers "whose session is this?". Whether that member is allowed
 * an answer at all — deactivated, suspended, suspension expired — stays ours,
 * and has to be enforced in two places:
 *
 *  - `src/server/auth.ts`, before a *new* session is minted (sign-in, passkey,
 *    OAuth), so a suspended member cannot get back in at all;
 *  - `src/server/http.ts`, on every request, so a member deactivated or
 *    suspended mid-session is denied on their next call.
 *
 * Pure and dependency-free: no mongoose, no env, no Response.
 */

/** The subset of a user doc these rules read. Mongoose docs satisfy it. */
export type AccountStatus = {
  isActive?: boolean | null;
  isSuspended?: boolean | null;
  suspendedUntil?: Date | string | null;
};

/**
 * True while a suspension is in force. `suspendedUntil` absent means
 * indefinite; a date in the past means the suspension has lapsed and the member
 * is welcome back without anyone having to clear the flag.
 */
export function isCurrentlySuspended(user: AccountStatus): boolean {
  if (!user.isSuspended) return false;
  if (!user.suspendedUntil) return true;
  return new Date() < new Date(user.suspendedUntil);
}

/** Why this member may hold no session, or null when they may. */
export type AccessDenial = 'deactivated' | 'suspended';

export function accessDenialReason(user: AccountStatus): AccessDenial | null {
  if (user.isActive === false) return 'deactivated';
  if (isCurrentlySuspended(user)) return 'suspended';
  return null;
}
