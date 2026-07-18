import { createFileRoute } from '@tanstack/react-router';
import { handler, error } from '../server/http';

// POST /api/auth/reset-password
// TODO: password-reset-by-emailed-token not wired in migration (no email sender).
export const Route = createFileRoute('/api/auth/reset-password')({
  server: {
    handlers: {
      POST: handler(async () => {
        return error(501, 'Password reset via email is not enabled in this build.');
      }),
    },
  },
});
