import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { Project, Comment } from '../server/models';
import { notifyMany } from '../server/notifications';
import { commentRecipients } from '../lib/notifications';

/**
 * /api/projects/$id/comments
 *   GET  → commentController.getProjectComments  (public)
 *   POST → commentController.createComment        (auth)
 *
 * Comments are nested under the project. Author is populated as `userId` with
 * `'username email'` (matching Express + the client `Comment` type). Raw docs
 * are returned so `_id`/`projectId`/`userId` are preserved.
 * (Legacy param was `:projectId`; here the shared first dynamic segment is `$id`.)
 */
export const Route = createFileRoute('/api/projects/$id/comments')({
  server: {
    handlers: {
      GET: handler(async ({ params }) => {
        await connectDB();

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        const comments = await Comment.find({ projectId: params.id })
          .populate('userId', 'username email')
          .sort({ createdAt: -1 })
          .exec();

        return json(comments);
      }),

      POST: handler(async ({ request, params }) => {
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

        const project = await Project.findById(params.id).exec();
        if (!project) return error(404, 'Project not found');

        const comment = await Comment.create({
          content,
          projectId: params.id,
          userId: user._id,
        });

        await comment.populate('userId', 'username email');

        // Notify the owner + accepted collaborators (minus the author).
        await notifyMany(commentRecipients(project, String(user._id)), {
          type: 'comment_posted',
          actor: String(user._id),
          projectId: String(params.id),
          commentId: String(comment._id),
        });

        return json(comment, 201);
      }),
    },
  },
});
