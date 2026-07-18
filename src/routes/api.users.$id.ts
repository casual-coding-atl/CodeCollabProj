import { createFileRoute } from '@tanstack/react-router';
import { handler, json, error, requireUser } from '../server/http';
import { connectDB } from '../server/db';
import { User } from '../server/models';

/**
 * GET /api/users/$id  →  userController.getUserById  (auth)
 *
 * Returns a single public profile (sensitive fields + `email` stripped).
 * Privacy: a PRIVATE profile is viewable only by its owner or by admin/moderator;
 * anyone else gets `403 This profile is private`. `404` if the id doesn't exist.
 * Response: `User`.
 */

const SENSITIVE_FIELDS =
  '-password -passwordResetToken -passwordResetExpires -emailVerificationToken -emailVerificationExpires';

export const Route = createFileRoute('/api/users/$id')({
  server: {
    handlers: {
      GET: handler(async ({ request, params }) => {
        const requester = await requireUser(request);
        await connectDB();

        const user = await User.findById(params.id)
          .select(`${SENSITIVE_FIELDS} -email`)
          .exec();

        if (!user) return error(404, 'User not found');

        const requesterId = requester._id?.toString();
        const isOwner = requesterId === user._id.toString();
        const isPrivileged = ['admin', 'moderator'].includes((requester.role as string) ?? '');

        if (!user.get('isProfilePublic') && !isOwner && !isPrivileged) {
          return error(403, 'This profile is private');
        }

        return json(user);
      }),
    },
  },
});
