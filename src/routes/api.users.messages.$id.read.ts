import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Message } from '../server/models';

/**
 * PUT /api/users/messages/$id/read  →  userController.markMessageAsRead  (auth)
 *
 * Marks a RECEIVED message read (only the recipient may mark it). Sets
 * `isRead:true` + `readAt:now` (matching the controller's field names — the
 * legacy `readAt`/`isRead` are written even though the lean schema declares
 * `read`; the collection is strict:false). 404 if not found / not the recipient.
 * Response: the updated `Message`.
 * (Legacy param was `:messageId`; here the shared dynamic segment is `$id`.)
 */
export const Route = createFileRoute('/api/users/messages/$id/read')({
  server: {
    handlers: {
      PUT: handler(async ({ request, params }) => {
        const me = await requireUser(request);
        await connectDB();

        const message = await Message.findOneAndUpdate(
          { _id: params.id, recipient: me._id },
          { isRead: true, readAt: new Date() },
          { new: true }
        ).exec();

        if (!message) return error(404, 'Message not found');

        return json(message);
      }),
    },
  },
});
