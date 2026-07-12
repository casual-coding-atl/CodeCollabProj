import { createFileRoute } from '@tanstack/react-router';
import { handler, json, readCookie, clearAuthCookies, ACCESS_COOKIE } from '../server/http';
import { connectDB } from '../server/db';
import { Session } from '../server/models';

// POST /api/auth/logout — revoke the current session and clear cookies.
export const Route = createFileRoute('/api/auth/logout')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const token = readCookie(request, ACCESS_COOKIE);
        if (token) {
          await connectDB();
          await Session.updateOne({ token }, { isActive: false }).catch(() => {});
        }
        return json({ message: 'Logged out successfully' }, 200, clearAuthCookies());
      }),
    },
  },
});
