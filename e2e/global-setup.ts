import { execFileSync } from 'node:child_process';
import type { FullConfig } from '@playwright/test';

/**
 * Seed a deterministic DB state before the E2E suite — into the DEDICATED E2E
 * database (from the webServer config's MONGODB_URI), never dev or production.
 * Idempotent; mirrors CI's pre-test seed. Passing MONGODB_URI in the child env
 * wins over `.env` (dotenv doesn't override already-set vars).
 */
export default function globalSetup(config: FullConfig): void {
  const ws = Array.isArray(config.webServer) ? config.webServer[0] : config.webServer;
  const uri = (ws?.env?.MONGODB_URI as string | undefined) || process.env.MONGODB_URI;
  execFileSync('node', ['-r', 'dotenv/config', 'scripts/seed-e2e.mjs'], {
    env: { ...process.env, MONGODB_URI: uri },
    stdio: 'inherit',
  });
}
