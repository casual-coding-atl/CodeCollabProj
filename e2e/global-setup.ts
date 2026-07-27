import { execFileSync } from 'node:child_process';
import { E2E_MONGODB_URI } from '../playwright.config';

/**
 * Prepare the DEDICATED E2E database — never dev, never production — in two
 * steps, both idempotent:
 *
 *   1. seed — writes the members in their PRE-migration shape: a legacy bcrypt
 *      `password` on the user doc, no Better Auth account row.
 *   2. migrate — runs the real one-off Better Auth migration over them.
 *
 * Doing it in that order is the point: the suite then signs in through the
 * browser with a password only the old stack ever hashed, which is the only way
 * to prove the migration path end to end (PRD #88).
 *
 * The connection string comes straight from `playwright.config.ts`, the same
 * value the E2E server is started with — NOT from Playwright's resolved config
 * (which does not expose `webServer[n].env` reliably once more than one server
 * is declared) and NOT from the ambient `MONGODB_URI`, which is the developer's
 * dev database. There is deliberately no fallback: a missing URI is a hard
 * error, because the cost of guessing wrong is seeding over real data.
 *
 * Passing MONGODB_URI in the child env wins over `.env` (dotenv doesn't
 * override already-set vars).
 */
export default function globalSetup(): void {
  const uri = E2E_MONGODB_URI;
  if (!uri) {
    throw new Error(
      'E2E setup needs a database: set MONGODB_URI (its database name is swapped for the E2E one) or E2E_MONGODB_URI.',
    );
  }

  const env = { ...process.env, MONGODB_URI: uri };
  // eslint-disable-next-line no-console
  console.log(`[e2e] preparing ${uri.replace(/\/\/[^@]*@/, '//')}`);

  execFileSync('node', ['-r', 'dotenv/config', 'scripts/seed-e2e.mjs'], {
    env,
    stdio: 'inherit',
  });

  execFileSync('npm', ['run', '--silent', 'migrate:auth'], { env, stdio: 'inherit' });
}
