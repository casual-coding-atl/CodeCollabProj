import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Notification } from '../server/models';

/** GET /api/notifications/unread-count — cheap unread count for the navbar badge. */
export const Route = createFileRoute('/api/notifications/unread-count')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();
        const count = await Notification.countDocuments({ userId: user._id, readAt: null });
        return json({ count });
      }),
    },
  },
});
