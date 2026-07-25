import { describe, it, expect, beforeEach, vi } from 'vitest';
import { APIError } from 'better-auth/api';
import { memoryAdapter } from 'better-auth/adapters/memory';

// The app-owned rules bolted onto Better Auth: who may be handed a session, who
// may hold a username, and what a production boot refuses to guess. Mongo is
// stubbed at the same seam http.test.ts uses, so everything asserted here is
// what a Better Auth endpoint would observe.

process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-username-checks';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const findById = vi.fn();
const exists = vi.fn();

vi.mock('./db', () => ({ connectDB: async () => undefined }));
vi.mock('./models', () => ({ User: { findById, exists } }));

const {
  assertMemberMaySignIn,
  assertUsernameAvailable,
  assertNoUsernameChange,
  buildAuth,
  deriveUsername,
  resolveBaseURL,
  sanitizeUsername,
  usernameSchema,
} = await import('./auth');

/** The next User.findById(...) resolves to this doc (null = no such member). */
function userDoc(user: Record<string, unknown> | null) {
  findById.mockReturnValue({ exec: async () => user });
}
/** Whether the next username uniqueness probe finds a holder. */
function usernameTakenBy(id: string | null) {
  exists.mockReturnValue({ exec: async () => (id ? { _id: id } : null) });
}

/**
 * Names this app already holds, answered case-insensitively — the same question
 * `User.exists` is asked with a `/^name$/i` regex, so the mock has to compare
 * the way Mongo would rather than by string equality.
 */
function usernamesInUse(...taken: string[]) {
  const held = taken.map((name) => name.toLowerCase());
  exists.mockImplementation(({ username }: { username: RegExp }) => ({
    exec: async () => (held.some((name) => username.test(name)) ? { _id: 'someone' } : null),
  }));
}

/** Every username `deriveUsername` probed, in order. */
function probed(): string[] {
  return (exists.mock.calls as Array<[{ username: RegExp }]>).map(([{ username }]) =>
    username.source.replace(/^\^|\$$/g, '').replace(/\\/g, ''),
  );
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

describe('sanitizeUsername', () => {
  // Whatever comes back has to be something a member could have typed into the
  // register form, so every case below is also checked against the schema.
  function sanitized(seed: unknown): string {
    const name = sanitizeUsername(seed);
    expect(usernameSchema.safeParse(name).success, `${name} is not a valid username`).toBe(true);
    return name;
  }

  it('keeps a GitHub login that already fits', () => {
    expect(sanitized('octocat')).toBe('octocat');
    expect(sanitized('Octo_Cat9')).toBe('Octo_Cat9');
  });

  it('turns the separators GitHub allows and we do not into underscores', () => {
    // GitHub logins may contain '-'; dropping it would run the words together.
    expect(sanitized('alex-robinett')).toBe('alex_robinett');
  });

  it('takes the local part of an email address', () => {
    expect(sanitized('alex.robinett@example.com')).toBe('alex_robinett');
  });

  it('collapses runs of separators and trims the edges', () => {
    expect(sanitized('--alex--robinett--')).toBe('alex_robinett');
  });

  it('pads a name too short to be legal', () => {
    // GitHub allows one-character logins; this app has never allowed under 3.
    expect(sanitized('jo')).toBe('jo_');
    expect(sanitized('x')).toBe('x__');
  });

  it('falls back to a stand-in when nothing usable survives', () => {
    expect(sanitized('---')).toBe('member');
    expect(sanitized('')).toBe('member');
    expect(sanitized(undefined)).toBe('member');
    expect(sanitized(null)).toBe('member');
  });

  it('truncates to the 30 characters the schema allows', () => {
    expect(sanitized('a'.repeat(40))).toBe('a'.repeat(30));
  });
});

describe('deriveUsername', () => {
  it('prefers the GitHub login over the email address', async () => {
    usernamesInUse();
    await expect(deriveUsername('octocat', 'someone-else@example.com')).resolves.toBe('octocat');
  });

  it('falls back to the email local part when GitHub has no login for them', async () => {
    usernamesInUse();
    await expect(deriveUsername(undefined, 'alex.robinett@example.com')).resolves.toBe(
      'alex_robinett',
    );
    await expect(deriveUsername('   ', 'alex@example.com')).resolves.toBe('alex');
  });

  it('adds a numeric suffix when the derived name is taken', async () => {
    usernamesInUse('octocat');
    await expect(deriveUsername('octocat', 'octocat@example.com')).resolves.toBe('octocat2');
  });

  it('keeps counting past the second collision', async () => {
    usernamesInUse('octocat', 'octocat2', 'octocat3');
    await expect(deriveUsername('octocat', null)).resolves.toBe('octocat4');
    expect(probed()).toEqual(['octocat', 'octocat2', 'octocat3', 'octocat4']);
  });

  it('will not hand somebody a name that differs only in case', async () => {
    // `Octocat` is somebody else. Mongo's case-insensitive probe is what
    // catches it, so the suffix is what the new member gets.
    usernamesInUse('OCTOCAT');
    await expect(deriveUsername('octocat', null)).resolves.toBe('octocat2');
  });

  it('makes room for the suffix rather than overrunning 30 characters', async () => {
    const long = 'a'.repeat(30);
    usernamesInUse(long);
    const name = await deriveUsername(long, null);
    expect(name).toBe(`${'a'.repeat(29)}2`);
    expect(usernameSchema.safeParse(name).success).toBe(true);
  });

  it('gives up rather than looping forever when everything is taken', async () => {
    exists.mockReturnValue({ exec: async () => ({ _id: 'someone' }) });
    const e = await thrown(() => deriveUsername('octocat', null));
    expect(e.status).toBe('CONFLICT');
    expect(e.body?.code).toBe('USERNAME_TAKEN');
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

describe('signing up with an email address', () => {
  // Asked of the real configuration over an in-memory store, because the claim
  // is about what Better Auth does with `username` — not about our helpers.
  // Deriving a username for GitHub must not have quietly made it optional for
  // everyone: a member who fills in the register form still names themselves.
  const auth = buildAuth(memoryAdapter({}));

  async function signUp(body: Record<string, unknown>): Promise<Response> {
    return auth.handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
  }

  it('still refuses a sign-up that names no username', async () => {
    usernamesInUse();
    const response = await signUp({
      email: 'nameless@example.com',
      password: 'a-long-enough-password',
      name: 'Nameless',
    });

    expect(response.status).toBe(400);
    const body = (await response.json()) as { code?: string; message?: string };
    expect(body.code).toBe('MISSING_FIELD');
    expect(body.message).toMatch(/username/i);
  });

  it('still refuses a username the format rules reject', async () => {
    usernamesInUse();
    const response = await signUp({
      email: 'punctuated@example.com',
      password: 'a-long-enough-password',
      name: 'Punctuated',
      username: 'has spaces',
    });

    expect(response.status).toBe(400);
    expect((await response.json()).message).toMatch(/letters, numbers, and underscores/i);
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
