import { describe, it, expect } from 'vitest';
import {
  planUserMigration,
  reportDataPathologies,
  type LegacyUser,
  type UserMigrationPlan,
} from './auth-migration';

// The one-off Better Auth migration's per-user transform. This is the pure core
// the `scripts/migrate-better-auth.mjs` driver runs for every legacy user; the
// driver only supplies the Mongo reads/writes. Behaviour asserted here is what a
// caller observes: the credential account row to upsert, the fields to backfill,
// what a default (additive) run refuses to remove — and that a second pass is a
// no-op.

const NOW = new Date('2026-07-24T12:00:00.000Z');
const HASH = '$2a$12$abcdefghijklmnopqrstuvABCDEFGHIJKLMNOPQRSTUVWXYZ012345';

function legacy(overrides: Partial<LegacyUser> = {}): LegacyUser {
  return {
    _id: 'user-object-id',
    email: 'member@example.com',
    username: 'member',
    password: HASH,
    isVerified: true,
    createdAt: new Date('2024-01-02T03:04:05.000Z'),
    ...overrides,
  };
}

/** Apply a plan to a plain user doc, the way the Mongo driver would. */
function apply(user: LegacyUser, plan: UserMigrationPlan): LegacyUser {
  const next = { ...user, ...plan.set } as LegacyUser & Record<string, unknown>;
  for (const field of plan.unset) delete next[field];
  return next;
}

/** A default (additive, pre-deploy) run. */
const additive = (user: LegacyUser, credentialAccount: { password?: string | null } | null = null) =>
  planUserMigration(user, { now: NOW, credentialAccount });

describe('planUserMigration', () => {
  it('creates a credential account row carrying the legacy bcrypt hash', () => {
    expect(additive(legacy()).account).toEqual({
      userId: 'user-object-id',
      accountId: 'user-object-id',
      providerId: 'credential',
      password: HASH,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('backfills name from username', () => {
    expect(additive(legacy()).set.name).toBe('member');
  });

  it('falls back to email for name when the legacy doc has no username', () => {
    expect(additive(legacy({ username: undefined })).set.name).toBe('member@example.com');
  });

  it('leaves an existing name alone', () => {
    expect(additive(legacy({ name: 'Already Named' })).set).not.toHaveProperty('name');
  });

  it('leaves a doc with neither username nor email nameless rather than inventing one', () => {
    const plan = additive(legacy({ username: undefined, email: undefined }));
    expect(plan.set).not.toHaveProperty('name');
    // The rest of the backfill still happens — the doc is not skipped.
    expect(plan.set.emailVerified).toBe(true);
    expect(plan.account).not.toBeNull();
  });

  it('backfills emailVerified from isVerified', () => {
    expect(additive(legacy({ isVerified: true })).set.emailVerified).toBe(true);
    expect(additive(legacy({ isVerified: false })).set.emailVerified).toBe(false);
  });

  it('accepts the isEmailVerified spelling the register endpoint wrote', () => {
    const plan = additive(legacy({ isVerified: undefined, isEmailVerified: false }));
    expect(plan.set.emailVerified).toBe(false);
  });

  it('defaults emailVerified to true when the legacy doc says nothing', () => {
    expect(additive(legacy({ isVerified: undefined })).set.emailVerified).toBe(true);
  });

  it('preserves an existing createdAt and stamps one when missing', () => {
    expect(additive(legacy()).set).not.toHaveProperty('createdAt');
    expect(additive(legacy({ createdAt: undefined })).set.createdAt).toBe(NOW);
  });

  it('coerces a string-typed legacy createdAt instead of clobbering it with now', () => {
    const plan = additive(legacy({ createdAt: '2021-05-06T07:08:09.000Z' }));
    expect(plan.set.createdAt).toEqual(new Date('2021-05-06T07:08:09.000Z'));
  });

  it('coerces an epoch-number createdAt too', () => {
    const plan = additive(legacy({ createdAt: 1620284889000 }));
    expect(plan.set.createdAt).toEqual(new Date(1620284889000));
  });

  it('falls back to now for a createdAt it cannot parse', () => {
    expect(additive(legacy({ createdAt: 'not a date' })).set.createdAt).toBe(NOW);
  });

  it('stamps updatedAt whenever it changes the doc', () => {
    expect(additive(legacy()).set.updatedAt).toBe(NOW);
  });

  it('reports a user with a legacy hash as needing work', () => {
    expect(additive(legacy()).changed).toBe(true);
  });

  it('is idempotent: a second pass over an already-migrated user is a no-op', () => {
    const user = legacy();
    const migrated = apply(user, additive(user));

    const second = planUserMigration(migrated, {
      now: new Date('2026-08-01T00:00:00.000Z'),
      credentialAccount: { password: HASH },
    });

    expect(second.changed).toBe(false);
    expect(second.account).toBeNull();
    expect(second.set).toEqual({});
    expect(second.unset).toEqual([]);
  });

  it('never re-issues a credential for a user whose account row already has a hash', () => {
    const plan = additive(legacy(), { password: HASH });
    expect(plan.account).toBeNull();
    expect(plan.accountRepair).toBe(false);
  });

  it('repairs an account row that exists but carries no hash', () => {
    // A half-finished earlier run: the row is there, the hash never landed, and
    // the member is locked out with the fix sitting on their user doc.
    const plan = additive(legacy(), { password: '' });
    expect(plan.account?.password).toBe(HASH);
    expect(plan.accountRepair).toBe(true);
    expect(plan.changed).toBe(true);
  });

  it('treats a missing password key on an existing account row as hashless too', () => {
    const plan = additive(legacy(), {});
    expect(plan.account?.password).toBe(HASH);
    expect(plan.accountRepair).toBe(true);
  });

  it('still backfills a user that has no legacy hash at all', () => {
    const plan = additive(legacy({ password: undefined }));
    expect(plan.account).toBeNull();
    expect(plan.unset).toEqual([]);
    expect(plan.set.name).toBe('member');
    expect(plan.changed).toBe(true);
  });

  it('stringifies ObjectId-ish ids for accountId while keeping userId as-is', () => {
    const id = { toString: () => '507f1f77bcf86cd799439011' };
    const plan = additive(legacy({ _id: id }));
    expect(plan.account?.accountId).toBe('507f1f77bcf86cd799439011');
    expect(plan.account?.userId).toBe(id);
  });

  describe('the legacy password field', () => {
    it('is left in place by a default run, so the legacy sign-in keeps working', () => {
      const plan = additive(legacy());
      expect(plan.unset).toEqual([]);
      expect(apply(legacy(), plan).password).toBe(HASH);
    });

    it('is dropped only under cleanup', () => {
      const plan = planUserMigration(legacy(), {
        now: NOW,
        credentialAccount: { password: HASH },
        cleanup: true,
      });
      expect(plan.unset).toEqual(['password']);
      expect(apply(legacy(), plan).password).toBeUndefined();
    });

    it('is nothing to drop under cleanup for an already-clean user', () => {
      // A second cleanup pass over a member the first one finished with.
      const done = apply(
        legacy(),
        planUserMigration(legacy(), { now: NOW, cleanup: true }),
      );
      const plan = planUserMigration(done, {
        now: NOW,
        credentialAccount: { password: HASH },
        cleanup: true,
      });
      expect(plan.unset).toEqual([]);
      expect(plan.changed).toBe(false);
    });

    it('is still copied to the account row on the same cleanup pass if it was missed', () => {
      const plan = planUserMigration(legacy(), { now: NOW, cleanup: true });
      expect(plan.account?.password).toBe(HASH);
      expect(plan.unset).toEqual(['password']);
    });
  });
});

describe('reportDataPathologies', () => {
  const u = (id: string, email?: string | null, username?: string | null): LegacyUser => ({
    _id: id,
    email,
    username,
  });

  it('calls a tidy set of users clean', () => {
    const report = reportDataPathologies([u('1', 'a@b.c', 'alex'), u('2', 'd@e.f', 'sam')]);
    expect(report.clean).toBe(true);
    expect(report.total).toBe(2);
  });

  it('flags users with no email — Better Auth cannot sign them in', () => {
    const report = reportDataPathologies([u('1', null, 'alex'), u('2', '', 'sam')]);
    expect(report.missingEmail).toEqual(['1', '2']);
    expect(report.clean).toBe(false);
  });

  it('flags emails that are not lowercased', () => {
    const report = reportDataPathologies([u('1', 'Alex@Example.com', 'alex')]);
    expect(report.nonLowercaseEmail).toEqual(['Alex@Example.com']);
  });

  it('flags emails that collide once lowercased', () => {
    const report = reportDataPathologies([u('1', 'a@b.c', 'one'), u('2', 'A@B.C', 'two')]);
    expect(report.duplicateEmails).toEqual([{ email: 'a@b.c', count: 2 }]);
  });

  it('flags missing and case-insensitively duplicated usernames', () => {
    const report = reportDataPathologies([
      u('1', 'a@b.c', 'Alex'),
      u('2', 'd@e.f', 'alex'),
      u('3', 'g@h.i', undefined),
    ]);
    expect(report.duplicateUsernames).toEqual([{ username: 'alex', count: 2 }]);
    expect(report.missingUsername).toEqual(['3']);
  });

  it('reads nothing but email and username — it never plans a write', () => {
    const report = reportDataPathologies([]);
    expect(report).toEqual({
      total: 0,
      missingEmail: [],
      nonLowercaseEmail: [],
      duplicateEmails: [],
      missingUsername: [],
      duplicateUsernames: [],
      clean: true,
    });
  });
});
