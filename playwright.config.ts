import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

// E2E runs its OWN server on a dedicated port with a DEDICATED database, so it
// never touches the dev DB (port 3000 / codecollabproj_dev) or production.
const PORT = Number(process.env.E2E_PORT) || 3100;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

// GitHub is stubbed for the whole suite: the app's single outbound edge is
// pointed at a local fixture server (e2e/fixtures/github-api.mjs) instead of
// api.github.com, so no test depends on the network, a rate limit, or a real
// repository's star count.
// 127.0.0.1, not localhost: the fixture binds loopback, and `localhost` can
// resolve to ::1 first on a machine with IPv6 — which would leave the app
// unable to reach it, or worse, reaching something else that answered.
const GITHUB_FIXTURE_PORT = Number(process.env.E2E_GITHUB_PORT) || 3199;
export const GITHUB_FIXTURE_URL = `http://127.0.0.1:${GITHUB_FIXTURE_PORT}`;

// Claude (Anthropic) is also stubbed: the evaluation route's single outbound
// edge is pointed at a local fixture so no test spends real API credits.
const CLAUDE_FIXTURE_PORT = Number(process.env.E2E_CLAUDE_PORT) || 3198;
export const CLAUDE_FIXTURE_URL = `http://127.0.0.1:${CLAUDE_FIXTURE_PORT}`;

/**
 * Swap the database name in a Mongo connection string, preserving creds/host/query.
 *
 * An unparseable URI throws rather than being handed back unchanged: returning
 * it silently meant the E2E run pointed at whatever database that string names —
 * in practice the developer's dev database — and then seeded and migrated it.
 * Failing loudly is the only safe answer when we can't prove we swapped the name.
 */
export function withDbName(uri: string, name: string): string {
  if (!uri) return uri; // absent is handled (and reported) by the global setup
  const [main, query] = uri.split('?');
  const m = main.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^/]*)?$/);
  if (!m) {
    throw new Error(
      `Could not read the database name out of MONGODB_URI, so the E2E database can't be derived from it. ` +
        `Set E2E_MONGODB_URI explicitly to the database the E2E suite may seed and wipe.`,
    );
  }
  return `${m[1]}/${name}${query ? `?${query}` : ''}`;
}

// Derive the E2E DB from the base MONGODB_URI (from .env / CI env). Override with
// E2E_MONGODB_URI if you want a completely separate cluster.
export const E2E_MONGODB_URI =
  process.env.E2E_MONGODB_URI ||
  withDbName(process.env.MONGODB_URI || '', process.env.E2E_DB_NAME || 'codecollabproj_e2e');

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Always the E2E server (never reuse the dev server): build+start locally, or
  // just start in CI (which builds in a prior step). Bound to the E2E DB + port.
  //
  // Neither server is ever reused. A server already listening on one of these
  // ports is not knowably *this* one: it may predate the code under test (the
  // build is part of the command, and reuse skips it), or have been started
  // with different env — pointed at the real api.github.com, or at another
  // database. Both would be silent. Failing to start on a busy port is loud,
  // and the fix is to kill whatever is holding it.
  webServer: [
    {
      command: process.env.CI ? 'npm start' : 'npm run build && npm start',
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 180_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(PORT),
        MONGODB_URI: E2E_MONGODB_URI,
        JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-test-secret-at-least-32-characters-1234',
        VITE_API_URL: '/api',
        // The cutover announcement is a build-time flag, off by default. The
        // E2E build turns it on so one spec can prove it is actually wired to
        // the login page — a unit test of the gate alone would still pass if
        // the variable name were misspelled in the component.
        VITE_AUTH_MIGRATION_NOTICE: '1',
        // Better Auth checks the request origin against its own base URL, so this
        // MUST be the E2E server's URL — pointed at :3000 it rejects every
        // sign-in from :3100 as a cross-origin request.
        BETTER_AUTH_URL: BASE_URL,
        BETTER_AUTH_SECRET:
          process.env.BETTER_AUTH_SECRET ??
          process.env.JWT_SECRET ??
          'e2e-test-secret-at-least-32-characters-1234',
        // Every GitHub read goes to the fixture server below, never to
        // api.github.com.
        GITHUB_API_BASE: GITHUB_FIXTURE_URL,
        // Every Claude call goes to the fixture server below, never to
        // api.anthropic.com. A fake key is required so the route doesn't
        // short-circuit with 503 before reaching the (stubbed) network.
        ANTHROPIC_API_BASE: CLAUDE_FIXTURE_URL,
        ANTHROPIC_API_KEY: 'e2e-test-anthropic-key',
        // Blanked deliberately, and not just left unset: this env is merged
        // over the process's, so a developer with a real OAuth app in their
        // .env would otherwise run a *different* server from CI's. The OAuth
        // round trip itself can't be tested — it leaves our origin — so what
        // the suite pins instead is that a server without an OAuth app says so
        // in a sentence rather than crashing (see e2e/auth.spec.ts).
        GITHUB_CLIENT_ID: '',
        GITHUB_CLIENT_SECRET: '',
      },
    },
    {
      command: 'node e2e/fixtures/github-api.mjs',
      url: `${GITHUB_FIXTURE_URL}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { GITHUB_FIXTURE_PORT: String(GITHUB_FIXTURE_PORT) },
    },
    {
      command: 'node e2e/fixtures/claude-api.mjs',
      url: `${CLAUDE_FIXTURE_URL}/healthz`,
      reuseExistingServer: false,
      timeout: 30_000,
      env: { CLAUDE_FIXTURE_PORT: String(CLAUDE_FIXTURE_PORT) },
    },
  ],
});
