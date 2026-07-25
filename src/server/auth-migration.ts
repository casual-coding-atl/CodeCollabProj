/**
 * Pure core of the one-off Better Auth migration (see ADR 0002).
 *
 * Legacy users carry their bcrypt hash in a `password` field on the user doc and
 * lack the fields Better Auth expects (`name`, `emailVerified`, timestamps).
 * This module decides, for a single user, what the migration should do; the
 * `scripts/migrate-better-auth.mjs` driver does the Mongo reads/writes around it
 * (it imports this file directly — Node ≥22.6 strips the types).
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
  /** Legacy bcrypt hash; moves to the credential account row. */
  password?: string | null;
  /** Better Auth's flag — absent on legacy docs. */
  emailVerified?: boolean;
  /** Legacy spellings of the same thing. */
  isVerified?: boolean;
  isEmailVerified?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
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

export type UserMigrationPlan = {
  /** Account row to insert, or null when there is nothing (new) to insert. */
  account: CredentialAccountRow | null;
  /** Fields to backfill on the user doc (`$set`). */
  set: Record<string, unknown>;
  /** Legacy fields to drop from the user doc (`$unset`). */
  unset: string[];
  /** False when this user is already fully migrated — the driver can skip it. */
  changed: boolean;
};

function nonEmpty(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Work out what migrating one legacy user requires. Idempotent by construction:
 * re-running against an already-migrated doc yields an empty, `changed: false`
 * plan, so the driver can be run as many times as the operator likes.
 */
export function planUserMigration(
  user: LegacyUser,
  opts: { now: Date; hasCredentialAccount: boolean },
): UserMigrationPlan {
  const { now, hasCredentialAccount } = opts;
  const hash = nonEmpty(user.password) ? user.password : null;

  const account: CredentialAccountRow | null =
    hash && !hasCredentialAccount
      ? {
          userId: user._id,
          accountId: String(user._id),
          providerId: 'credential',
          password: hash,
          createdAt: now,
          updatedAt: now,
        }
      : null;

  const set: Record<string, unknown> = {};

  // name ← username (email as fallback); never clobber a name that exists.
  if (!nonEmpty(user.name)) {
    const name = nonEmpty(user.username) ? user.username : user.email;
    if (nonEmpty(name)) set.name = name;
  }

  // emailVerified ← isVerified / isEmailVerified, defaulting to verified
  // (registration has created verified accounts all along — see CLAUDE.md).
  if (typeof user.emailVerified !== 'boolean') {
    set.emailVerified = user.isVerified ?? user.isEmailVerified ?? true;
  }

  if (!(user.createdAt instanceof Date)) set.createdAt = now;

  const unset = hash ? ['password'] : [];

  const touched = account !== null || Object.keys(set).length > 0 || unset.length > 0;
  if (touched || !(user.updatedAt instanceof Date)) set.updatedAt = now;

  return {
    account,
    set,
    unset,
    changed: account !== null || Object.keys(set).length > 0 || unset.length > 0,
  };
}
