import { describe, it, expect } from 'vitest';
import { planUserMigration, type LegacyUser, type UserMigrationPlan } from './auth-migration';

// The one-off Better Auth migration's per-user transform. This is the pure core
// the `scripts/migrate-better-auth.mjs` driver runs for every legacy user; the
// driver only supplies the Mongo reads/writes. Behaviour asserted here is what a
// caller observes: the credential account row to insert, the fields to backfill,
// the legacy fields to drop — and that a second pass is a no-op.

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

describe('planUserMigration', () => {
  it('creates a credential account row carrying the legacy bcrypt hash', () => {
    const plan = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false });
    expect(plan.account).toEqual({
      userId: 'user-object-id',
      accountId: 'user-object-id',
      providerId: 'credential',
      password: HASH,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it('drops the legacy password field from the user doc', () => {
    const plan = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false });
    expect(plan.unset).toEqual(['password']);
    expect(apply(legacy(), plan).password).toBeUndefined();
  });

  it('backfills name from username', () => {
    const plan = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false });
    expect(plan.set.name).toBe('member');
  });

  it('falls back to email for name when the legacy doc has no username', () => {
    const plan = planUserMigration(legacy({ username: undefined }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(plan.set.name).toBe('member@example.com');
  });

  it('leaves an existing name alone', () => {
    const plan = planUserMigration(legacy({ name: 'Already Named' }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(plan.set).not.toHaveProperty('name');
  });

  it('backfills emailVerified from isVerified', () => {
    const verified = planUserMigration(legacy({ isVerified: true }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    const unverified = planUserMigration(legacy({ isVerified: false }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(verified.set.emailVerified).toBe(true);
    expect(unverified.set.emailVerified).toBe(false);
  });

  it('accepts the isEmailVerified spelling the register endpoint wrote', () => {
    const plan = planUserMigration(legacy({ isVerified: undefined, isEmailVerified: false }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(plan.set.emailVerified).toBe(false);
  });

  it('defaults emailVerified to true when the legacy doc says nothing', () => {
    const plan = planUserMigration(legacy({ isVerified: undefined }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(plan.set.emailVerified).toBe(true);
  });

  it('preserves an existing createdAt and stamps one when missing', () => {
    const kept = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false });
    expect(kept.set).not.toHaveProperty('createdAt');

    const stamped = planUserMigration(legacy({ createdAt: undefined }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(stamped.set.createdAt).toBe(NOW);
  });

  it('stamps updatedAt whenever it changes the doc', () => {
    const plan = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false });
    expect(plan.set.updatedAt).toBe(NOW);
  });

  it('reports a user with a legacy hash as needing work', () => {
    expect(planUserMigration(legacy(), { now: NOW, hasCredentialAccount: false }).changed).toBe(
      true,
    );
  });

  it('is idempotent: a second pass over an already-migrated user is a no-op', () => {
    const user = legacy();
    const first = planUserMigration(user, { now: NOW, hasCredentialAccount: false });
    const migrated = apply(user, first);

    const second = planUserMigration(migrated, {
      now: new Date('2026-08-01T00:00:00.000Z'),
      hasCredentialAccount: true,
    });

    expect(second.changed).toBe(false);
    expect(second.account).toBeNull();
    expect(second.set).toEqual({});
    expect(second.unset).toEqual([]);
  });

  it('never issues a second credential account for a user that already has one', () => {
    // Belt and braces: even if a legacy hash somehow lingers on the user doc.
    const plan = planUserMigration(legacy(), { now: NOW, hasCredentialAccount: true });
    expect(plan.account).toBeNull();
    expect(plan.unset).toEqual(['password']);
  });

  it('still backfills a user that has no legacy hash at all', () => {
    const plan = planUserMigration(legacy({ password: undefined }), {
      now: NOW,
      hasCredentialAccount: false,
    });
    expect(plan.account).toBeNull();
    expect(plan.unset).toEqual([]);
    expect(plan.set.name).toBe('member');
    expect(plan.changed).toBe(true);
  });

  it('stringifies ObjectId-ish ids for accountId while keeping userId as-is', () => {
    const id = { toString: () => '507f1f77bcf86cd799439011' };
    const plan = planUserMigration(legacy({ _id: id }), { now: NOW, hasCredentialAccount: false });
    expect(plan.account?.accountId).toBe('507f1f77bcf86cd799439011');
    expect(plan.account?.userId).toBe(id);
  });
});
