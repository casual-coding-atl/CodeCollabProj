import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Notification } from '../server/models';

/**
 * POST /api/notifications/mark-read — mark notifications read.
 * Body: `{ all: true }` to clear everything, or `{ ids: [...] }` for specific ones.
 * Scoped to the caller, so you can only ever mark your own. Returns the new unread count.
 */
export const Route = createFileRoute('/api/notifications/mark-read')({
  server: {
    handlers: {
      POST: handler(async ({ request }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as {
          ids?: unknown;
          all?: boolean;
        };

        const filter: Record<string, unknown> = { userId: user._id, readAt: null };
        if (!body.all) {
          const ids = Array.isArray(body.ids) ? body.ids.filter((x) => typeof x === 'string') : [];
          if (ids.length === 0) return error(400, 'Provide ids[] or all:true');
          filter._id = { $in: ids };
        }

        const res = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
        const unread = await Notification.countDocuments({ userId: user._id, readAt: null });
        return json({ updated: res.modifiedCount ?? 0, unread });
      }),
    },
  },
});
