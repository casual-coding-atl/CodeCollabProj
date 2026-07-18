import { createFileRoute } from '@tanstack/react-router';
import { handler, json, getAuthUser, clearAuthCookies } from '../server/http';
import { connectDB } from '../server/db';
import { Session } from '../server/models';

// POST /api/auth/logout-all — revoke ALL of the user's active sessions.
export const Route = createFileRoute('/api/auth/logout-all')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const user = await getAuthUser(request);
        if (user) {
          await connectDB();
          await Session.updateMany({ userId: user._id, isActive: true }, { isActive: false }).catch(
            () => {},
          );
        }
        return json({ message: 'Logged out from all devices' }, 200, clearAuthCookies());
      }),
    },
  },
});
