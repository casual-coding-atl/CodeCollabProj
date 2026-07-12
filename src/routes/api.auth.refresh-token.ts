import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, getAuthUser } from '../server/http';

// POST /api/auth/refresh-token
// The migration issues long-lived (7d) access tokens, so there is no short-token
// refresh cycle to service; report current auth state based on the cookie.
export const Route = createFileRoute('/api/auth/refresh-token')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const user = await getAuthUser(request);
        if (!user) return error(401, 'Not authenticated');
        return json({ message: 'Session active', expiresIn: 7 * 24 * 60 * 60 });
      }),
    },
  },
});
