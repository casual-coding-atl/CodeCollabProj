import { createFileRoute } from '@tanstack/react-router';
import { handler, json } from '../server/http';

// POST /api/auth/resend-verification
// TODO: email sending not wired in migration.
export const Route = createFileRoute('/api/auth/resend-verification')({
  server: {
    handlers: {
      POST: handler(async () =>
        json({ message: 'If your account requires verification, an email has been sent.' }),
      ),
    },
  },
});
