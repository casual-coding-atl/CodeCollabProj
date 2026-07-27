/**
 * Pure core of the one-off Better Auth migration (see ADR 0002).
 *
 * Legacy users carry their bcrypt hash in a `password` field on the user doc and
 * lack the fields Better Auth expects (`name`, `emailVerified`, timestamps).
 * This module decides, for a single user, what the migration should do; the
 * `scripts/migrate-better-auth.mjs` driver does the Mongo reads/writes around it
 * (it imports this file directly — Node ≥22.6 strips the types).
 *
 * The default plan is purely ADDITIVE: it writes the credential account row and
 * backfills fields, and leaves the legacy `password` field where it is. That is
 * what makes the script safe to run *before* the auth deploy — the still-live
 * legacy sign-in keeps reading that field, and rolling back is just redeploying
 * the old code. Dropping it is a separate, opt-in `cleanup: true` pass, for
 * after the new sign-in has been verified in production.
 *
 * Deliberately dependency-free so it stays testable and importable from plain
 * ESM: no mongoose, no mongodb, no env.
 */

export type LegacyUser = {
  _id: unknown;
  email?: string | null;
  username?: string | null;
  /** Better Auth's display name — absent on legacy docs. */
  name?: string | null;
  /** Legacy bcrypt hash; copied to the credential account row. */
  password?: string | null;
  /** Better Auth's flag — absent on legacy docs. */
  emailVerified?: boolean;
  /** Legacy spellings of the same thing. */
  isVerified?: boolean;
  isEmailVerified?: boolean;
  /** Dates on paper; legacy docs sometimes hold ISO strings. */
  createdAt?: unknown;
  updatedAt?: unknown;
};

/** A row in Better Auth's `account` collection holding a password credential. */
export type CredentialAccountRow = {
  userId: unknown;
  accountId: string;
  providerId: 'credential';
  password: string;
  createdAt: Date;
  updatedAt: Date;
};

/** The member's existing `credential` account row, as read from Mongo. */
export type ExistingCredentialAccount = {
  password?: string | null;
};

export type UserMigrationPlan = {
  /**
   * The credential account row to upsert on `{ userId, providerId }`, or null
   * when there is nothing to write. The driver upserts rather than inserts, so
   * this doubles as the repair for a row that exists without a usable hash.
   */
  account: CredentialAccountRow | null;
  /** True when `account` repairs an existing hashless row rather than creating one. */
  accountRepair: boolean;
  /** Fields to backfill on the user doc (`$set`). */
  set: Record<string, unknown>;
  /** Legacy fields to drop from the user doc (`$unset`) — only under `cleanup`. */
  unset: string[];
  /** False when this user needs nothing — the driver can skip it. */
  changed: boolean;
};

export type UserMigrationOptions = {
  now: Date;
  /**
   * The member's existing `credential` account row, if the driver found one.
   * Passing the row (rather than a boolean) is what lets the plan notice a row
   * that exists but carries no hash — a half-finished earlier run, which would
   * otherwise lock the member out with the fix sitting right there on the user
   * doc.
   */
  credentialAccount?: ExistingCredentialAccount | null;
  /**
   * Drop the legacy `password` field from the user doc. Post-cutover only: with
   * it set, the hash lives solely in the `account` collection and rolling back
   * to the legacy sign-in is no longer possible.
   */
  cleanup?: boolean;
};

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * A usable Date, or null. Legacy docs written by different code paths hold
 * `createdAt` as an ISO string or an epoch number as often as a real Date;
 * those carry the right instant, so coerce them rather than clobbering the
 * member's join date with `now`.
 */
function asDate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Work out what migrating one legacy user requires. Idempotent by construction:
 * re-running against an already-migrated doc yields an empty, `changed: false`
 * plan, so the driver can be run as many times as the operator likes.
 */
export function planUserMigration(
  user: LegacyUser,
  opts: UserMigrationOptions,
): UserMigrationPlan {
  const { now, credentialAccount = null, cleanup = false } = opts;
  const legacyHash = nonEmpty(user.password) ? user.password : null;
  const storedHash = credentialAccount && nonEmpty(credentialAccount.password)
    ? credentialAccount.password
    : null;

  // Write the credential row when the member has a legacy hash and the account
  // collection does not already hold one. A row that exists *without* a hash is
  // a broken half-migration: repair it from the legacy field.
  const account: CredentialAccountRow | null =
    legacyHash && !storedHash
      ? {
          userId: user._id,
          accountId: String(user._id),
          providerId: 'credential',
          password: legacyHash,
          createdAt: now,
          updatedAt: now,
        }
      : null;
  const accountRepair = account !== null && credentialAccount !== null;

  const set: Record<string, unknown> = {};

  // name ← username (email as fallback); never clobber a name that exists. A
  // doc with neither stays nameless rather than gaining the string "undefined".
  if (!nonEmpty(user.name)) {
    const name = nonEmpty(user.username) ? user.username : user.email;
    if (nonEmpty(name)) set.name = name;
  }

  // emailVerified ← isVerified / isEmailVerified, defaulting to verified
  // (registration has created verified accounts all along — see CLAUDE.md).
  if (typeof user.emailVerified !== 'boolean') {
    set.emailVerified = user.isVerified ?? user.isEmailVerified ?? true;
  }

  // createdAt: keep a real Date, coerce a parseable string/number, else stamp.
  if (!(user.createdAt instanceof Date)) {
    set.createdAt = asDate(user.createdAt) ?? now;
  }

  // Dropping the legacy hash is opt-in: see the module comment.
  const unset = cleanup && legacyHash ? ['password'] : [];

  const touched = account !== null || Object.keys(set).length > 0 || unset.length > 0;
  if (touched) {
    set.updatedAt = now;
  } else if (!(user.updatedAt instanceof Date)) {
    set.updatedAt = asDate(user.updatedAt) ?? now;
  }

  return {
    account,
    accountRepair,
    set,
    unset,
    changed: account !== null || Object.keys(set).length > 0 || unset.length > 0,
  };
}

// ── pre-flight report ────────────────────────────────────────────────────────

/**
 * What the driver reports (read-only) before it writes anything. Better Auth
 * looks members up by lowercased email and treats it as unique, and the app now
 * treats usernames as case-insensitively unique — legacy data guarantees
 * neither, so surface the rows that will misbehave *before* the cutover rather
 * than as sign-in tickets after it.
 */
export type DataPathologyReport = {
  total: number;
  missingEmail: unknown[];
  nonLowercaseEmail: string[];
  duplicateEmails: Array<{ email: string; count: number }>;
  missingUsername: unknown[];
  duplicateUsernames: Array<{ username: string; count: number }>;
  clean: boolean;
};

/** Build the report from every user doc. Reads only. */
export function reportDataPathologies(users: Iterable<LegacyUser>): DataPathologyReport {
  const missingEmail: unknown[] = [];
  const nonLowercaseEmail: string[] = [];
  const missingUsername: unknown[] = [];
  const emailCounts = new Map<string, number>();
  const usernameCounts = new Map<string, number>();
  let total = 0;

  for (const user of users) {
    total += 1;
    if (!nonEmpty(user.email)) {
      missingEmail.push(user._id);
    } else {
      if (user.email !== user.email.toLowerCase()) nonLowercaseEmail.push(user.email);
      const key = user.email.toLowerCase();
      emailCounts.set(key, (emailCounts.get(key) ?? 0) + 1);
    }
    if (!nonEmpty(user.username)) {
      missingUsername.push(user._id);
    } else {
      const key = user.username.toLowerCase();
      usernameCounts.set(key, (usernameCounts.get(key) ?? 0) + 1);
    }
  }

  const duplicateEmails = [...emailCounts]
    .filter(([, count]) => count > 1)
    .map(([email, count]) => ({ email, count }));
  const duplicateUsernames = [...usernameCounts]
    .filter(([, count]) => count > 1)
    .map(([username, count]) => ({ username, count }));

  return {
    total,
    missingEmail,
    nonLowercaseEmail,
    duplicateEmails,
    missingUsername,
    duplicateUsernames,
    clean:
      missingEmail.length === 0 &&
      nonLowercaseEmail.length === 0 &&
      duplicateEmails.length === 0 &&
      missingUsername.length === 0 &&
      duplicateUsernames.length === 0,
  };
}
