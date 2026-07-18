import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Session } from '../server/models';

// GET /api/auth/sessions — the user's active sessions (tokens stripped).
export const Route = createFileRoute('/api/auth/sessions')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();
        const sessions = await Session.find({
          userId: user._id,
          isActive: true,
          expiresAt: { $gt: new Date() },
        })
          .select('-token -refreshToken')
          .sort({ lastActivity: -1 })
          .lean();
        return json({ sessions });
      }),
    },
  },
});
