/**
 * Pure decision: is a pending evaluation considered abandoned?
 *
 * "Abandoned" means the request that created the pending document never
 * resolved — the server crashed, the process was restarted, or the HTTP
 * connection was torn down mid-flight — leaving the document stuck in `pending`
 * with no agent ever completing it. A new run from the same owner must not be
 * refused because of a ghost document.
 *
 * The threshold is a named constant so it appears in unit tests and in the
 * route with the same value and a clear name, not a bare magic number.
 *
 * This module is deliberately side-effect-free: no DB, no env reads, no hidden
 * time state. Every decision is a pure function of its arguments so unit tests
 * can cover every branch without stubs.
 */

/** Pending evaluations older than this are treated as abandoned. */
export const ABANDONED_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Returns true when a pending evaluation should be treated as abandoned and its
 * slot reopened for a new run.
 *
 * @param requestedAt  When the pending document was created (Date or ISO string).
 * @param now          The current time — injectable for deterministic tests.
 *                     Defaults to `new Date()`.
 */
export function isEvaluationAbandoned(
  requestedAt: Date | string,
  now: Date = new Date(),
): boolean {
  const createdMs = new Date(requestedAt).getTime();
  if (isNaN(createdMs)) return true; // malformed timestamp → treat as abandoned
  return now.getTime() - createdMs > ABANDONED_THRESHOLD_MS;
}
