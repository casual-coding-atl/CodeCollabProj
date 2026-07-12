import { createFileRoute } from '@tanstack/react-router';
import { handler, json } from '../server/http';

// POST /api/auth/request-password-reset
// TODO: email sending not wired in migration — returns the same generic success
// message the controller returns (avoids account enumeration).
export const Route = createFileRoute('/api/auth/request-password-reset')({
  server: {
    handlers: {
      POST: handler(async () => {
        return json({
          message: 'If an account with that email exists, a password reset link has been sent.',
        });
      }),
    },
  },
});
