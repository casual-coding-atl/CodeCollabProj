import { createFileRoute } from '@tanstack/react-router';
import { handler, json, requireUser, query } from '../server/http';
import { connectDB } from '../server/db';
import { Notification } from '../server/models';

/**
 * GET /api/notifications — the current user's notification feed, newest first,
 * paginated (?page, ?limit), with `actor` and `projectId` populated for display.
 */
export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();

        const q = query(request);
        const limit = Math.min(50, Math.max(1, Number(q.get('limit')) || 20));
        const page = Math.max(1, Number(q.get('page')) || 1);

        const items = await Notification.find({ userId: user._id })
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .populate('actor', '_id username profileImage')
          .populate('projectId', '_id title')
          .exec();

        return json(items);
      }),
    },
  },
});
