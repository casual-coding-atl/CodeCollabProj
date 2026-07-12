import { createFileRoute } from '@tanstack/react-router';
import { handler, json } from '../server/http';

// GET /api/auth/verify-email/$token
// TODO: email verification not wired in migration.
export const Route = createFileRoute('/api/auth/verify-email/$token')({
  server: {
    handlers: {
      GET: handler(async () =>
        json({ message: 'Email verification is not enabled in this build.' }, 200),
      ),
    },
  },
});
