import { execFileSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';

/**
 * Prepare the DEDICATED E2E database (from the webServer config's MONGODB_URI,
 * never dev or production) in two steps, both idempotent:
 *
 *   1. seed — writes the members in their PRE-migration shape: a legacy bcrypt
 *      `password` on the user doc, no Better Auth account row.
 *   2. migrate — runs the real one-off Better Auth migration over them.
 *
 * Doing it in that order is the point: the suite then signs in through the
 * browser with a password only the old stack ever hashed, which is the only way
 * to prove the migration path end to end (PRD #88).
 *
 * Passing MONGODB_URI in the child env wins over `.env` (dotenv doesn't
 * override already-set vars).
 */
export default function globalSetup(config: FullConfig): void {
  const ws = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  const uri = (ws?.env?.MONGODB_URI as string | undefined) || process.env.MONGODB_URI;
  const env = { ...process.env, MONGODB_URI: uri };

  execFileSync('node', ['-r', 'dotenv/config', 'scripts/seed-e2e.mjs'], {
    env,
    stdio: 'inherit',
  });

  execFileSync('npm', ['run', '--silent', 'migrate:auth'], { env, stdio: 'inherit' });
}
