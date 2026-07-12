import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Message } from '../server/models';

/**
 * /api/users/messages/$id
 *   DELETE → userController.deleteMessage  (auth)
 *
 * Deletes a message the current user is either the sender OR recipient of.
 * 404 `Message not found or access denied` otherwise. Response:
 * `{ message: 'Message deleted successfully' }`.
 *
 * NOTE: the Express router had NO `GET /messages/:messageId` and no
 * `getMessageById` controller (the client's `getMessageById` caller has no
 * server counterpart), so GET is intentionally not implemented here.
 * (Legacy param was `:messageId`; here the shared dynamic segment is `$id`.)
 */
export const Route = createFileRoute('/api/users/messages/$id')({
  server: {
    handlers: {
      DELETE: handler(async ({ request, params }) => {
        const me = await requireUser(request);
        await connectDB();

        const message = await Message.findOneAndDelete({
          _id: params.id,
          $or: [{ sender: me._id }, { recipient: me._id }],
        }).exec();

        if (!message) return error(404, 'Message not found or access denied');

        return json({ message: 'Message deleted successfully' });
      }),
    },
  },
});
