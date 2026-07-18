import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Comment } from '../server/models';

/**
 * /api/projects/$id/comments/$commentId
 *   PUT    → commentController.updateComment  (comment owner only)
 *   DELETE → commentController.deleteComment   (comment owner only)
 *
 * Ownership is checked against `comment.userId`. Updated comment is returned with
 * `userId` populated ('username email'), matching Express + the client `Comment`.
 */
export const Route = createFileRoute('/api/projects/$id/comments/$commentId')({
  server: {
    handlers: {
      PUT: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const body = (await request.json().catch(() => ({}))) as { content?: unknown };

        // Mirror commentValidator: content required, 1-1000 chars.
        const content = typeof body.content === 'string' ? body.content.trim() : '';
        const errors: Array<{ type: string; msg: string; path: string; location: string }> = [];
        if (!content) {
          errors.push({
            type: 'field',
            msg: 'Comment content is required',
            path: 'content',
            location: 'body',
          });
        } else if (content.length < 1 || content.length > 1000) {
          errors.push({
            type: 'field',
            msg: 'Comment must be between 1 and 1000 characters',
            path: 'content',
            location: 'body',
          });
        }
        if (errors.length > 0) return json({ errors }, 400);

        const comment = await Comment.findById(params.commentId).exec();
        if (!comment) return error(404, 'Comment not found');

        // Comment-owner only.
        if (String(comment.userId) !== String(user._id)) {
          return error(403, 'Not authorized to update this comment');
        }

        comment.content = content;
        await comment.save();
        await comment.populate('userId', 'username email');

        return json(comment);
      }),

      DELETE: handler(async ({ request, params }) => {
        const user = await requireUser(request);
        await connectDB();

        const comment = await Comment.findById(params.commentId).exec();
        if (!comment) return error(404, 'Comment not found');

        // Comment-owner only.
        if (String(comment.userId) !== String(user._id)) {
          return error(403, 'Not authorized to delete this comment');
        }

        await comment.deleteOne();
        return json({ message: 'Comment deleted successfully' });
      }),
    },
  },
});
