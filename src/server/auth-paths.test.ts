import { describe, it, expect, vi } from 'vitest';
import { memoryAdapter } from 'better-auth/adapters/memory';

/**
 * What the auth API refuses to serve.
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
 */

process.env.BETTER_AUTH_SECRET ??= 'test-secret-for-disabled-path-checks';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

vi.mock('./db', () => ({ connectDB: async () => undefined }));
vi.mock('./models', () => ({ User: { findById: vi.fn(), exists: vi.fn() } }));

const { buildAuth, DISABLED_AUTH_PATHS } = await import('./auth');

const auth = buildAuth(memoryAdapter({}));

async function post(path: string): Promise<Response> {
  return auth.handler(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    }),
  );
}

describe('disabled auth endpoints', () => {
  it.each([
    ['/get-access-token', 'would hand a browser the member’s GitHub token'],
    ['/refresh-token', 'would mint a fresh one just as readably'],
    ['/account-info', 'spends the member’s GitHub rate budget for no feature'],
    ['/sign-in/social', 'GitHub is for linking only, never for signing in'],
  ])('answers 404 for %s (%s)', async (path) => {
    const response = await post(path);
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
      '/sign-in/social',
      '/get-access-token',
      '/refresh-token',
      '/account-info',
    ]);
  });
});
