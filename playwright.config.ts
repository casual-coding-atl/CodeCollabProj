import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';

// E2E runs its OWN server on a dedicated port with a DEDICATED database, so it
// never touches the dev DB (port 3000 / codecollabproj_dev) or production.
const PORT = Number(process.env.E2E_PORT) || 3100;
const BASE_URL = process.env.E2E_BASE_URL || `http://localhost:${PORT}`;

/** Swap the database name in a Mongo connection string, preserving creds/host/query. */
function withDbName(uri: string, name: string): string {
  if (!uri) return uri;
  const [main, query] = uri.split('?');
  const m = main.match(/^(mongodb(?:\+srv)?:\/\/[^/]+)(?:\/[^/]*)?$/);
  if (!m) return uri;
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
  webServer: {
    command: process.env.CI ? 'npm start' : 'npm run build && npm start',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      NODE_ENV: 'test',
      PORT: String(PORT),
      MONGODB_URI: E2E_MONGODB_URI,
      JWT_SECRET: process.env.JWT_SECRET ?? 'e2e-test-secret-at-least-32-characters-1234',
      VITE_API_URL: '/api',
      // Better Auth checks the request origin against its own base URL, so this
      // MUST be the E2E server's URL — pointed at :3000 it rejects every
      // sign-in from :3100 as a cross-origin request.
      BETTER_AUTH_URL: BASE_URL,
      BETTER_AUTH_SECRET:
        process.env.BETTER_AUTH_SECRET ??
        process.env.JWT_SECRET ??
        'e2e-test-secret-at-least-32-characters-1234',
    },
  },
});
