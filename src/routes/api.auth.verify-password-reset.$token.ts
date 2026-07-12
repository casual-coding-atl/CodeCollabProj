import { createFileRoute } from '@tanstack/react-router';
import { handler, json } from '../server/http';

// GET /api/auth/verify-password-reset/$token
// TODO: not wired in migration — reports the token as invalid/expired.
export const Route = createFileRoute('/api/auth/verify-password-reset/$token')({
  server: {
    handlers: {
      GET: handler(async () => json({ valid: false, message: 'Invalid or expired token' })),
    },
  },
});
