import { execFileSync } from 'node:child_process';

/**
 * Seed a deterministic DB state before the E2E suite: the two E2E users, the
 * sample project (collaborators reset), and cleared notifications. Idempotent —
 * mirrors what CI runs via `npm run test:e2e:seed` before Playwright, so local
 * runs get the same clean slate and tests don't leak state into each other.
 */
export default function globalSetup(): void {
  execFileSync('node', ['-r', 'dotenv/config', 'scripts/seed-e2e.mjs'], {
    stdio: 'inherit',
  });
}
