import { describe, it, expect, vi } from 'vitest';
import { memoryAdapter } from 'better-auth/adapters/memory';

/**
 * What the auth API serves, and what it refuses to.
 *
 * These are asked of the *real* configuration (src/server/auth.ts), built over
 * an in-memory store rather than Mongo, so what is asserted is what a browser
 * would get from `/api/auth/*` — not a restatement of the config.
 *
 * The load-bearing ones are the token endpoints. Better Auth mounts
 * `/get-access-token` and `/refresh-token` unconditionally, and they hand the
 * caller the member's decrypted GitHub OAuth token. Linking is only safe
 * because that token stays on the server (PRD #88, story 24); a 200 from either
 * of these would quietly make every signed-in tab — and any XSS in one — able
 * to spend a member's GitHub credentials.
 *
 * `/sign-in/social` is the mirror image, and used to be on the same list: it is
 * how signing in with GitHub starts, so it has to be reachable, and a regression
 * that shut it again would take the login page's GitHub button with it.
 */

process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-disabled-path-checks';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
// A GitHub OAuth app, so the provider is actually registered here. Without
// these the provider is absent and every social request is a 404 for a reason
// that has nothing to do with what this file is about. (What a server with no
// credentials does is pinned from the outside, in e2e/auth.spec.ts.)
process.env.GITHUB_CLIENT_ID ??= 'test-github-client-id';
process.env.GITHUB_CLIENT_SECRET ??= 'test-github-client-secret';

vi.mock('./db', () => ({ connectDB: async () => undefined }));
vi.mock('./models', () => ({ User: { findById: vi.fn(), exists: vi.fn() } }));

const { buildAuth, DISABLED_AUTH_PATHS } = await import('./auth');

const auth = buildAuth(memoryAdapter({}));

async function post(path: string, body: unknown = {}): Promise<Response> {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

describe('disabled auth endpoints', () => {
  it.each([
    ['/get-access-token', 'would hand a browser the member’s GitHub token'],
    ['/refresh-token', 'would mint a fresh one just as readably'],
    ['/account-info', 'spends the member’s GitHub rate budget for no feature'],
  ])('answers 404 for %s (%s)', async (path) => {
    const response = await post(path, { providerId: 'github' });
    expect(response.status).toBe(404);
  });

  it('still serves an endpoint that is not disabled', async () => {
    // A control: 404 above has to mean "we turned this off", not "nothing is
    // mounted". Sign-in with nonsense credentials is a 4xx, but never a 404.
    const response = await post('/sign-in/email');
    expect(response.status).not.toBe(404);
  });

  it('lists every disabled path in one place', () => {
    expect([...DISABLED_AUTH_PATHS]).toEqual([
      '/get-access-token',
      '/refresh-token',
      '/account-info',
    ]);
  });
});

describe('signing in with GitHub', () => {
  it('starts the round trip instead of 404ing', async () => {
    const response = await post('/sign-in/social', {
      provider: 'github',
      callbackURL: 'http://localhost:3000/dashboard',
    });

    expect(response.status).toBe(200);

    // And it is a real GitHub authorization URL for *our* client, not just any
    // 200 — asking for the identity scopes the app was registered with.
    const { url } = (await response.json()) as { url?: string };
    expect(url).toBeTruthy();
    const authorize = new URL(url as string);
    expect(`${authorize.origin}${authorize.pathname}`).toBe(
      'https://github.com/login/oauth/authorize',
    );
    expect(authorize.searchParams.get('client_id')).toBe('test-github-client-id');
    expect(authorize.searchParams.get('scope')).toContain('user:email');
  });

  it('leaves the token endpoints shut all the same', async () => {
    // The control that keeps the two decisions apart: opening social sign-in
    // must not have opened the endpoints that hand a browser the OAuth token.
    const response = await post('/get-access-token', { providerId: 'github' });
    expect(response.status).toBe(404);
  });
});
