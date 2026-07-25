import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIError } from 'better-auth/api';

// The app-owned rules bolted onto Better Auth: who may be handed a session, who
// may hold a username, and what a production boot refuses to guess. Mongo is
// stubbed at the same seam http.test.ts uses, so everything asserted here is
// what a Better Auth endpoint would observe.

const findById = vi.fn();
const exists = vi.fn();

vi.mock('./db', () => ({ connectDB: async () => undefined }));
vi.mock('./models', () => ({ User: { findById, exists } }));

const { assertMemberMaySignIn, assertUsernameAvailable, assertNoUsernameChange, resolveBaseURL, usernameSchema } =
  await import('./auth');

/** The next User.findById(...) resolves to this doc (null = no such member). */
function userDoc(user: Record<string, unknown> | null) {
  findById.mockReturnValue({ exec: async () => user });
}
/** Whether the next username uniqueness probe finds a holder. */
function usernameTakenBy(id: string | null) {
  exists.mockReturnValue({ exec: async () => (id ? { _id: id } : null) });
}

const active = { _id: 'user-1', email: 'a@b.c', isActive: true, isSuspended: false };

/** Run `fn` and return the APIError it threw. */
async function thrown(fn: () => Promise<unknown>): Promise<APIError> {
  const e = await fn().then(
    () => null,
    (err: unknown) => err,
  );
  expect(e).toBeInstanceOf(APIError);
  return e as APIError;
}

beforeEach(() => {
  findById.mockReset();
  exists.mockReset();
});

describe('assertMemberMaySignIn', () => {
  it('lets an active member through', async () => {
    userDoc(active);
    await expect(assertMemberMaySignIn('user-1')).resolves.toBeUndefined();
  });

  it('refuses a deactivated member a new session', async () => {
    userDoc({ ...active, isActive: false });
    const e = await thrown(() => assertMemberMaySignIn('user-1'));
    expect(e.status).toBe('FORBIDDEN');
    expect(e.body?.code).toBe('ACCOUNT_DEACTIVATED');
  });

  it('refuses a member suspended indefinitely', async () => {
    userDoc({ ...active, isSuspended: true });
    const e = await thrown(() => assertMemberMaySignIn('user-1'));
    expect(e.body?.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('refuses a member suspended until a future date', async () => {
    userDoc({ ...active, isSuspended: true, suspendedUntil: new Date(Date.now() + 86_400_000) });
    const e = await thrown(() => assertMemberMaySignIn('user-1'));
    expect(e.body?.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('lets a member back in once their suspension has lapsed', async () => {
    userDoc({ ...active, isSuspended: true, suspendedUntil: new Date(Date.now() - 86_400_000) });
    await expect(assertMemberMaySignIn('user-1')).resolves.toBeUndefined();
  });

  it('refuses a session for a user doc that no longer exists', async () => {
    userDoc(null);
    const e = await thrown(() => assertMemberMaySignIn('user-1'));
    expect(e.body?.code).toBe('USER_NOT_FOUND');
  });

  it('looks the member up by the id the session carries', async () => {
    userDoc(active);
    await assertMemberMaySignIn('abc123');
    expect(findById).toHaveBeenCalledWith('abc123');
  });
});

describe('assertUsernameAvailable', () => {
  it('accepts a username nobody holds', async () => {
    usernameTakenBy(null);
    await expect(assertUsernameAvailable('newcomer')).resolves.toBeUndefined();
  });

  it('rejects a username that is already taken', async () => {
    usernameTakenBy('user-9');
    const e = await thrown(() => assertUsernameAvailable('member'));
    expect(e.status).toBe('CONFLICT');
    expect(e.body?.code).toBe('USERNAME_TAKEN');
  });

  it('compares case-insensitively, so Alex cannot join alex', async () => {
    usernameTakenBy(null);
    await assertUsernameAvailable('Alex');
    const [{ username }] = exists.mock.calls[0] as [{ username: RegExp }];
    expect(username.flags).toContain('i');
    expect(username.test('alex')).toBe(true);
    expect(username.test('alexander')).toBe(false);
  });

  it('escapes regex metacharacters rather than letting them match wildly', async () => {
    usernameTakenBy(null);
    await assertUsernameAvailable('a.c');
    const [{ username }] = exists.mock.calls[0] as [{ username: RegExp }];
    expect(username.test('abc')).toBe(false);
    expect(username.test('a.c')).toBe(true);
  });

  it('has nothing to check when no username was supplied', async () => {
    await expect(assertUsernameAvailable(undefined)).resolves.toBeUndefined();
    expect(exists).not.toHaveBeenCalled();
  });
});

describe('usernameSchema', () => {
  it('accepts the legacy format: 3–30 letters, digits and underscores', () => {
    for (const name of ['abc', 'a_1', 'A'.repeat(30)]) {
      expect(usernameSchema.safeParse(name).success).toBe(true);
    }
  });

  it('rejects usernames that are too short, too long, or oddly punctuated', () => {
    for (const name of ['ab', 'A'.repeat(31), 'has space', 'has-dash', 'wat?', '']) {
      expect(usernameSchema.safeParse(name).success).toBe(false);
    }
  });

  it('trims before judging, so surrounding whitespace is not stored', () => {
    expect(usernameSchema.parse('  member  ')).toBe('member');
  });
});

describe('assertNoUsernameChange', () => {
  it('rejects a username on Better Auth’s always-on POST /update-user', () => {
    let caught: unknown;
    try {
      assertNoUsernameChange('/update-user', { username: 'someone_else' });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(APIError);
    expect((caught as APIError).body?.code).toBe('USERNAME_CANNOT_BE_UPDATED');
  });

  it('rejects blanking a username just as firmly', () => {
    expect(() => assertNoUsernameChange('/update-user', { username: '' })).toThrow(APIError);
    expect(() => assertNoUsernameChange('/update-user', { username: null })).toThrow(APIError);
  });

  it('leaves the fields update-user is meant to own alone', () => {
    expect(() => assertNoUsernameChange('/update-user', { name: 'New Name' })).not.toThrow();
  });

  it('does not interfere with any other endpoint', () => {
    expect(() => assertNoUsernameChange('/sign-up/email', { username: 'member' })).not.toThrow();
  });

  it('tolerates a missing or non-object body', () => {
    expect(() => assertNoUsernameChange('/update-user', undefined)).not.toThrow();
    expect(() => assertNoUsernameChange('/update-user', 'nonsense')).not.toThrow();
  });
});

describe('resolveBaseURL', () => {
  it('uses BETTER_AUTH_URL when it is set', () => {
    expect(resolveBaseURL({ BETTER_AUTH_URL: 'https://app.example.com' })).toBe(
      'https://app.example.com',
    );
  });

  it('falls back to localhost in development', () => {
    expect(resolveBaseURL({ NODE_ENV: 'development' })).toBe('http://localhost:3000');
  });

  it('refuses to guess an origin in production', () => {
    // A prod deploy that fell back to localhost would trust the wrong origin
    // and set a non-Secure cookie. Fail the boot instead.
    expect(() => resolveBaseURL({ NODE_ENV: 'production' })).toThrow(/BETTER_AUTH_URL/);
    expect(() => resolveBaseURL({ NODE_ENV: 'production', BETTER_AUTH_URL: '  ' })).toThrow(
      /BETTER_AUTH_URL/,
    );
  });

  it('is satisfied by a configured URL in production', () => {
    expect(
      resolveBaseURL({ NODE_ENV: 'production', BETTER_AUTH_URL: 'https://app.example.com' }),
    ).toBe('https://app.example.com');
  });
});
