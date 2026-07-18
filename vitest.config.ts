import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Unit-test seam: pure logic only (no DOM, no network). E2E lives in e2e/.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
