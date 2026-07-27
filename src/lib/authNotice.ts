/**
 * The one-time sign-out announcement for the Better Auth cutover (PRD #88,
 * story 27).
 *
 * Retiring the legacy `sessions` collection signs every member out exactly
 * once. That is a deliberate, communicated event rather than a fault, and the
 * place a member meets it is the login screen they were unexpectedly returned
 * to — so that is where we explain it.
 *
 * It is off unless an operator turns it on: `VITE_AUTH_MIGRATION_NOTICE=1` at
 * BUILD time, for the cutover window only. A build without the flag has no
 * notice in it at all, which is what we want for the other 51 weeks of the year.
 */

/** What members read. Kept here so the deploy runbook and the UI can't drift. */
export const AUTH_MIGRATION_NOTICE =
  "We've upgraded how sign-in works — everyone was signed out once. Your existing password still works.";

/**
 * Whether to show it, from the raw env value.
 *
 * Deliberately strict about what counts as on: an unset variable is `undefined`,
 * and an unset variable in a shell script is often the empty string or the
 * *string* `"false"` — none of which should surface a stale announcement to
 * every member months after the migration.
 */
export function migrationNoticeEnabled(flag: unknown): boolean {
  return flag === true || flag === '1' || flag === 'true';
}
